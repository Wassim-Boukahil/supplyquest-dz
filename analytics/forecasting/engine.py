"""Small, explainable demand forecasting engine.

The engine accepts an already tenant-scoped daily series from Node. It does
not access the database, so authorization and source-of-truth decisions remain
in the Node application.
"""

from __future__ import annotations

from datetime import date, timedelta
from math import sqrt
from statistics import mean, pstdev
from typing import Any

METHODS = (
    "NAIVE_LAST_VALUE",
    "MOVING_AVERAGE_7_DAY",
    "EXPONENTIAL_SMOOTHING",
)


def _non_negative(value: float) -> float:
    return round(max(0.0, float(value)), 4)


def _average(values: list[float]) -> float:
    return mean(values) if values else 0.0


def _predict(method: str, values: list[float], horizon: int) -> list[float]:
    if not values:
        return [0.0] * horizon
    if method == "NAIVE_LAST_VALUE":
        level = values[-1]
    elif method == "MOVING_AVERAGE_7_DAY":
        level = _average(values[-7:])
    elif method == "EXPONENTIAL_SMOOTHING":
        level = values[0]
        alpha = 0.3
        for value in values[1:]:
            level = alpha * value + (1 - alpha) * level
    else:
        raise ValueError(f"Unsupported forecasting method: {method}")
    return [_non_negative(level)] * horizon


def _metrics(actual: list[float], predicted: list[float]) -> dict[str, Any]:
    pairs = list(zip(actual, predicted))
    if not pairs:
        return {"mae": None, "rmse": None, "mape": None, "observations": 0}
    errors = [prediction - observed for observed, prediction in pairs]
    absolute = [abs(error) for error in errors]
    non_zero = [abs(observed) for observed, _ in pairs if observed != 0]
    percentages = [
        abs(observed - prediction) / abs(observed) * 100
        for observed, prediction in pairs
        if observed != 0
    ]
    return {
        "mae": round(_average(absolute), 4),
        "rmse": round(sqrt(_average([error * error for error in errors])), 4),
        # MAPE is intentionally null when every actual is zero.
        "mape": round(_average(percentages), 4) if non_zero else None,
        "observations": len(pairs),
    }


def _backtest(values: list[float], dates: list[str]) -> dict[str, Any]:
    if len(values) < 21:
        return {
            "evaluation_window": 0,
            "metrics": {method: {"mae": None, "rmse": None, "mape": None, "observations": 0} for method in METHODS},
            "backtest_points": [],
        }
    holdout = min(14, max(7, len(values) // 4))
    train = values[:-holdout]
    actual = values[-holdout:]
    metrics: dict[str, Any] = {}
    points: list[dict[str, Any]] = []
    for method in METHODS:
        prediction = _predict(method, train, holdout)
        metrics[method] = _metrics(actual, prediction)
        if method == "EXPONENTIAL_SMOOTHING":
            points = [
                {"date": dates[-holdout + index], "offset": index, "actual": round(observed, 4), "predicted": round(predicted, 4)}
                for index, (observed, predicted) in enumerate(zip(actual, prediction))
            ]
    return {"evaluation_window": holdout, "metrics": metrics, "backtest_points": points}


def _trend(values: list[float]) -> dict[str, Any]:
    if len(values) < 28:
        return {"direction": "INSUFFICIENT", "magnitude_percent": None, "explanation": "At least 28 daily observations are needed to compare two 14-day demand windows."}
    recent = _average(values[-14:])
    prior = _average(values[-28:-14])
    magnitude = None if prior == 0 else (recent - prior) / prior * 100
    if magnitude is None:
        direction = "UP" if recent > 0 else "STABLE"
    elif magnitude >= 5:
        direction = "UP"
    elif magnitude <= -5:
        direction = "DOWN"
    else:
        direction = "STABLE"
    detail = "no prior non-zero baseline" if magnitude is None else f"{abs(magnitude):.1f}% {'above' if magnitude >= 0 else 'below'} the prior 14-day baseline"
    return {"direction": direction, "magnitude_percent": round(magnitude, 4) if magnitude is not None else None, "explanation": f"Recent demand is {detail}."}


def _seasonality(values: list[float]) -> dict[str, Any]:
    if len(values) < 56:
        return {"detected": False, "type": None, "strength": None, "explanation": "At least eight weeks of daily observations are needed to test weekly seasonality."}
    weekday_values: dict[int, list[float]] = {index: [] for index in range(7)}
    for index, value in enumerate(values):
        weekday_values[index % 7].append(value)
    means = [_average(weekday_values[index]) for index in range(7)]
    overall = _average(values)
    spread = pstdev(means) if len(means) > 1 else 0.0
    total_spread = pstdev(values) if len(values) > 1 else 0.0
    strength = min(1.0, spread / total_spread) if total_spread else 0.0
    detected = strength >= 0.2 and overall > 0
    return {
        "detected": detected,
        "type": "WEEKLY" if detected else None,
        "strength": round(strength, 4) if detected else None,
        "explanation": "A recurring weekday pattern is visible in the available history." if detected else "No defensible weekly pattern was detected.",
    }


def _quality(status: str, selected_metrics: dict[str, Any], values: list[float]) -> tuple[str, str]:
    if status == "INSUFFICIENT":
        return "INSUFFICIENT_DATA", "There is not enough historical demand to evaluate a reliable forecast."
    rmse = selected_metrics.get("rmse")
    average = _average(values)
    if rmse is None or average == 0:
        return "LOW", "The series has limited non-zero demand, so historical error cannot support high confidence."
    ratio = rmse / average
    if ratio <= 0.35:
        return "HIGH", f"Historical RMSE is {rmse:.2f} units/day against an average of {average:.2f}."
    if ratio <= 0.75:
        return "MEDIUM", f"Historical RMSE is {rmse:.2f} units/day against an average of {average:.2f}; variability remains material."
    return "LOW", f"Historical RMSE is {rmse:.2f} units/day against an average of {average:.2f}."


def forecast(payload: dict[str, Any]) -> dict[str, Any]:
    horizon = int(payload.get("horizon_days", 14))
    if horizon not in (7, 14, 30):
        raise ValueError("horizon_days must be 7, 14, or 30")
    raw_observations = payload.get("observations", [])
    observations = sorted(
        [{"date": str(item["date"]), "units": _non_negative(float(item.get("units", 0)))} for item in raw_observations],
        key=lambda item: item["date"],
    )
    if not observations:
        status = "INSUFFICIENT"
        values: list[float] = []
        first_day = date.today()
    else:
        first_day = date.fromisoformat(observations[0]["date"])
        requested_end = payload.get("end_date")
        last_day = date.fromisoformat(requested_end) if requested_end else date.fromisoformat(observations[-1]["date"])
        if last_day < date.fromisoformat(observations[-1]["date"]):
            last_day = date.fromisoformat(observations[-1]["date"])
        by_day = {item["date"]: item["units"] for item in observations}
        values = []
        dates: list[str] = []
        cursor = first_day
        while cursor <= last_day:
            dates.append(cursor.isoformat())
            values.append(by_day.get(cursor.isoformat(), 0.0))
            cursor += timedelta(days=1)
        non_zero_days = sum(1 for value in values if value > 0)
        status = "SUFFICIENT" if len(values) >= 56 and non_zero_days >= 14 else "LIMITED" if len(values) >= 14 and non_zero_days >= 4 else "INSUFFICIENT"

    backtest = _backtest(values, dates if observations else [])
    if status == "INSUFFICIENT":
        selected_method = "NONE"
        candidate_methods: list[str] = []
        selected_metrics = {"mae": None, "rmse": None, "mape": None, "observations": 0}
        predictions = [0.0] * horizon
        selection_reason = "Forecast withheld because the minimum history rule was not met."
    else:
        candidate_methods = list(METHODS)
        available = [(method, result["rmse"]) for method, result in backtest["metrics"].items() if result["rmse"] is not None]
        selected_method = min(available, key=lambda item: item[1])[0] if available else "EXPONENTIAL_SMOOTHING"
        selected_metrics = backtest["metrics"].get(selected_method, {"mae": None, "rmse": None, "mape": None, "observations": 0})
        predictions = _predict(selected_method, values, horizon)
        selection_reason = "Selected the candidate with the lowest chronological backtest RMSE." if available else "Limited history; exponential smoothing provides a stable level without claiming a validated winner."

    trend = _trend(values)
    seasonality = _seasonality(values)
    quality, quality_reason = _quality(status, selected_metrics, values)
    uncertainty_available = selected_metrics.get("rmse") is not None and selected_metrics.get("observations", 0) >= 7
    interval = 1.96 * float(selected_metrics["rmse"]) if uncertainty_available else None
    last_day = date.fromisoformat(observations[-1]["date"]) if observations else first_day - timedelta(days=1)
    forecast_points = []
    for index, prediction in enumerate(predictions, start=1):
        forecast_date = last_day + timedelta(days=index)
        forecast_points.append({
            "date": forecast_date.isoformat(),
            "predicted": round(prediction, 4),
            "lower": round(max(0.0, prediction - interval), 4) if interval is not None else None,
            "upper": round(prediction + interval, 4) if interval is not None else None,
        })
    return {
        "data_status": status,
        "history_start": observations[0]["date"] if observations else None,
        "history_end": observations[-1]["date"] if observations else None,
        "observation_count": len(values),
        "non_zero_observation_count": sum(1 for value in values if value > 0),
        "selected_method": selected_method,
        "candidate_methods": candidate_methods,
        "selection_reason": selection_reason,
        "trend": trend,
        "seasonality": seasonality,
        "quality": quality,
        "quality_reason": quality_reason,
        "uncertainty_available": uncertainty_available,
        "uncertainty_method": "95% interval from chronological backtest RMSE" if uncertainty_available else None,
        "evaluation_period": backtest["evaluation_window"],
        "metrics": selected_metrics,
        "candidate_metrics": backtest["metrics"],
        "historical": observations,
        "forecast": forecast_points,
        "backtest": backtest["backtest_points"],
    }