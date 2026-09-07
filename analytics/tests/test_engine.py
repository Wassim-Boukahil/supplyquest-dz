import unittest
from datetime import date, timedelta

from analytics.forecasting.engine import forecast


def observations(values):
    start = date(2026, 1, 1)
    return [{"date": (start + timedelta(days=index)).isoformat(), "units": value} for index, value in enumerate(values)]


class ForecastEngineTests(unittest.TestCase):
    def test_insufficient_history_is_explicit(self):
        result = forecast({"observations": observations([3, 0, 2]), "horizon_days": 7})
        self.assertEqual(result["data_status"], "INSUFFICIENT")
        self.assertEqual(result["quality"], "INSUFFICIENT_DATA")
        self.assertEqual(result["selected_method"], "NONE")
        self.assertTrue(all(point["lower"] is None for point in result["forecast"]))

    def test_methods_backtest_chronologically_and_mape_ignores_zero_actuals(self):
        result = forecast({"observations": observations(([4] * 20) + ([0, 4] * 25)), "horizon_days": 14})
        self.assertIn(result["selected_method"], {"NAIVE_LAST_VALUE", "MOVING_AVERAGE_7_DAY", "EXPONENTIAL_SMOOTHING"})
        self.assertGreater(result["metrics"]["observations"], 0)
        self.assertIsNotNone(result["metrics"]["mae"])
        self.assertIsNotNone(result["metrics"]["rmse"])
        self.assertIsNotNone(result["metrics"]["mape"])
        self.assertEqual(len(result["forecast"]), 14)

    def test_trend_and_uncertainty_are_explainable(self):
        result = forecast({"observations": observations(([2] * 28) + ([3] * 14) + ([8] * 14)), "horizon_days": 30})
        self.assertEqual(result["trend"]["direction"], "UP")
        self.assertGreater(result["trend"]["magnitude_percent"], 100)
        self.assertTrue(result["uncertainty_available"])
        self.assertTrue(all(point["upper"] is not None for point in result["forecast"]))
        self.assertEqual(len(result["forecast"]), 30)

    def test_invalid_horizon_fails(self):
        with self.assertRaises(ValueError):
            forecast({"observations": observations([1] * 30), "horizon_days": 10})


if __name__ == "__main__":
    unittest.main()