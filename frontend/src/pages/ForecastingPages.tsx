import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, RefreshCw, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Button, Card, EmptyState, ErrorState, LoadingState, Select } from "../components/ui";
import { DetailCard, EmptyPanel, PageHeader, PaginationBar, StatusBadge, Table } from "../components/phase1";
import { apiRequest } from "../lib/api";
import { asNumber, type ForecastOverview, type ForecastPerformance, type ForecastPoint, type ForecastProductData, type ForecastRun, type ListResult } from "../lib/phase1";
import { useLocale } from "../lib/i18n";

const number = (value: number | string | null | undefined, digits = 1) => value === null || value === undefined ? "—" : asNumber(value).toFixed(digits);
const date = (value: string) => new Date(value).toLocaleDateString();
const methodName = (value: string) => value.replaceAll("_", " ");

function Metric({ label, value, hint, tone = "" }: { label: string; value: string; hint: string; tone?: string }) {
  return <Card className={`intel-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{hint}</small></Card>;
}

function Quality({ value }: { value: string }) {
  return <StatusBadge status={value} />;
}

function QualityBars({ items }: { items: { quality: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <div className="health-bars">{items.map((item) => <div className="health-bar-row" key={item.quality}><span>{item.quality.replaceAll("_", " ")}</span><div><i className={`bar-${item.quality.toLowerCase()}`} style={{ width: `${Math.max(4, item.count / max * 100)}%` }} /></div><strong>{item.count}</strong></div>)}</div>;
}

export function ForecastingOverviewPage() {
  const { t } = useLocale();
  const [overview, setOverview] = useState<ForecastOverview | null>(null);
  const [performance, setPerformance] = useState<ForecastPerformance | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setOverview(null);
    setError("");
    Promise.all([apiRequest<ForecastOverview>("/api/v1/forecasting/overview"), apiRequest<ForecastPerformance>("/api/v1/forecasting/performance")])
      .then(([nextOverview, nextPerformance]) => { setOverview(nextOverview); setPerformance(nextPerformance); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load forecasting."));
  };
  useEffect(load, []);
  return <AppShell><PageHeader eyebrow={`${t("forecasting")} / ${t("overview")}`} title={t("forecasting")} description={t("whyForecast")} action={<Button variant="secondary" onClick={load}><RefreshCw size={15} /> {t("refresh")}</Button>} />{error ? <ErrorState message={error} /> : !overview || !performance ? <LoadingState /> : <><div className="metric-grid intelligence-metrics"><Metric label={t("forecastableProducts")} value={String(overview.forecastableProducts)} hint={t("sufficientHistory")} tone="metric-good" /><Metric label={t("insufficientData")} value={String(overview.insufficientData)} hint={t("dataSufficiency")} tone="metric-warn" /><Metric label={t("highQualityForecasts")} value={String(overview.highQualityForecasts)} hint={t("forecastQuality")} tone="metric-good" /><Metric label={t("averageMae")} value={number(performance.averageMae)} hint="Units/day" /><Metric label={t("averageRmse")} value={number(performance.averageRmse)} hint="Units/day" /><Metric label={t("forecastRuns")} value={String(overview.forecastRuns)} hint={t("forecastHistory")} /></div><div className="dashboard-grid"><Card className="chart-card"><div className="section-heading"><div><p className="eyebrow">{t("forecastQuality")}</p><h2>{t("qualityDistribution")}</h2></div></div><QualityBars items={overview.qualityDistribution} /></Card><Card className="chart-card"><div className="section-heading"><div><p className="eyebrow">{t("forecastVsActual")}</p><h2>{t("methodComparison")}</h2></div></div>{performance.methods.length ? <Table headers={[t("method"), t("forecastRuns"), t("averageMae")]}>{performance.methods.map((item) => <tr key={item.method}><td><span className="table-primary">{methodName(item.method)}</span></td><td>{item.runs}</td><td>{number(item.averageMae)}</td></tr>)}</Table> : <EmptyState message={t("noForecast")} />}</Card></div><Card className="list-card"><div className="section-heading compact"><div><p className="eyebrow">{t("forecastHistory")}</p><h2>{t("recentForecastRuns")}</h2></div><Link className="inline-link" to="/intelligence">{t("intelligence")} <ArrowRight size={13} /></Link></div>{overview.recentRuns.length ? <Table headers={[t("products"), t("warehouses"), t("forecastQuality"), t("method"), t("averageMae"), t("generated")]}>{overview.recentRuns.map((run) => <tr key={run.id}><td><Link className="table-primary intelligence-link" to={`/forecasting/products/${run.productId}`}>{run.product.name}<ArrowRight size={13} /></Link><small>{run.product.sku}</small></td><td>{run.warehouse?.name ?? "All warehouses"}</td><td><Quality value={run.quality} /></td><td>{run.quality === "INSUFFICIENT_DATA" ? "—" : methodName(run.selectedMethod)}</td><td>{number(run.mae)}</td><td>{date(run.generatedAt)}</td></tr>)}</Table> : <EmptyPanel title={t("noForecast")} message={t("generateForecast")} />}</Card></>}</AppShell>;
}

function ForecastChart({ historical, forecast }: { historical: { date: string; units: number }[]; forecast: ForecastPoint[] }) {
  const items = [...historical.slice(-14).map((point) => ({ label: point.date, value: point.units, type: "actual" })), ...forecast.filter((point) => point.pointType === "FORECAST").slice(0, 14).map((point) => ({ label: point.forecastDate, value: point.predictedQuantity, type: "forecast" }))];
  const max = Math.max(1, ...items.map((item) => item.value));
  return <div className="forecast-chart" aria-label="Historical demand and forecast chart">{items.map((item) => <div className={`forecast-bar ${item.type}`} key={`${item.type}-${item.label}`} title={`${item.label}: ${item.value}`}><i style={{ height: `${Math.max(5, item.value / max * 100)}%` }} /><span>{item.label.slice(5)}</span></div>)}</div>;
}

function RunDetails({ run, t }: { run: ForecastRun; t: (key: string) => string }) {
  return <><div className="forecast-summary"><div><span className="eyebrow">{t("forecastQuality")}</span><Quality value={run.quality} /></div><div><span className="eyebrow">{t("method")}</span><strong>{methodName(run.selectedMethod)}</strong></div><div><span className="eyebrow">{t("dataSufficiency")}</span><strong>{run.dataStatus}</strong></div><div><span className="eyebrow">{t("uncertainty")}</span><strong>{run.uncertaintyAvailable ? t("available") : t("notAvailable")}</strong></div></div><div className="detail-grid"><DetailCard title={t("whyForecast")}><div className="explanation-panel"><p>{run.qualityReason}</p><p>{run.selectionReason}</p><dl><div><dt>{t("averageMae")}</dt><dd>{number(run.mae)} units/day</dd></div><div><dt>{t("averageRmse")}</dt><dd>{number(run.rmse)} units/day</dd></div><div><dt>MAPE</dt><dd>{number(run.mape)}%</dd></div><div><dt>{t("trend")}</dt><dd>{run.trendDirection}{run.trendMagnitude === null ? "" : ` (${run.trendMagnitude >= 0 ? "+" : ""}${number(run.trendMagnitude)}%)`}</dd></div><div><dt>{t("seasonality")}</dt><dd>{run.seasonalityDetected ? `${run.seasonalityType} (${number(run.seasonalityStrength, 2)})` : t("notDetected")}</dd></div></dl><small className="muted-copy">{run.uncertaintyAvailable ? run.uncertaintyMethod : t("noUncertainty")}</small></div></DetailCard><DetailCard title={t("forecastDemand")}><Table headers={[t("date"), t("predicted"), t("estimatedRange")]}>{run.points.filter((point) => point.pointType === "FORECAST").map((point) => <tr key={point.id}><td>{date(point.forecastDate)}</td><td><strong>{number(point.predictedQuantity)}</strong></td><td>{point.lowerBound === null || point.upperBound === null ? "—" : `${number(point.lowerBound)} – ${number(point.upperBound)}`}</td></tr>)}</Table></DetailCard></div></>;
}

export function ForecastingProductPage() {
  const { id } = useParams();
  const { t } = useLocale();
  const [data, setData] = useState<ForecastProductData | null>(null);
  const [error, setError] = useState("");
  const [horizon, setHorizon] = useState("14");
  const [warehouseId, setWarehouseId] = useState("");
  const [generating, setGenerating] = useState(false);
  const load = () => { if (!id) return; setError(""); apiRequest<ForecastProductData>(`/api/v1/forecasting/products/${id}${warehouseId ? `?warehouseId=${warehouseId}` : ""}`).then(setData).catch((err) => setError(err instanceof Error ? err.message : "Unable to load forecast.")); };
  useEffect(load, [id, warehouseId]);
  async function generate() {
    if (!id) return;
    setGenerating(true); setError("");
    try {
      await apiRequest(`/api/v1/forecasting/products/${id}/generate`, { method: "POST", body: JSON.stringify({ horizonDays: Number(horizon), ...(warehouseId ? { warehouseId } : {}) }) });
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to generate forecast."); }
    finally { setGenerating(false); }
  }
  if (error && !data) return <AppShell><PageHeader eyebrow={t("forecasting")} title={t("forecasting")} back="/forecasting" /><ErrorState message={error} /></AppShell>;
  if (!data) return <AppShell><LoadingState /></AppShell>;
  const run = data.run;
  const backtest = run?.points.filter((point) => point.pointType === "BACKTEST") ?? [];
  return <AppShell><PageHeader eyebrow={`${t("forecasting")} / ${t("products")}`} title={data.product.name} description={`${data.product.sku} · ${data.product.unit}`} back="/forecasting" action={<div className="button-group"><Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}><option value="">All warehouses</option>{data.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</Select><Select value={horizon} onChange={(event) => setHorizon(event.target.value)}><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></Select><Button onClick={generate} disabled={generating}><Sparkles size={15} /> {generating ? t("generating") : t("generateForecast")}</Button></div>} />{error && <ErrorState message={error} />}{run ? <><RunDetails run={run} t={t} /><Card className="chart-card"><div className="section-heading"><div><p className="eyebrow">{t("historicalDemand")} / {t("forecastDemand")}</p><h2>{t("forecastVsActual")}</h2></div></div><ForecastChart historical={data.historical} forecast={run.points} /><div className="chart-legend"><span className="legend-actual">{t("historicalDemand")}</span><span className="legend-forecast">{t("forecastDemand")}</span></div></Card><Card className="list-card"><div className="section-heading compact"><div><p className="eyebrow">{t("backtesting")}</p><h2>{t("forecastVsActual")}</h2></div><span className="muted-copy">{run.evaluationPeriod} {t("observations")}</span></div>{backtest.length ? <Table headers={[t("date"), t("actual"), t("predicted"), t("error")]}>{backtest.map((point) => <tr key={point.id}><td>{date(point.forecastDate)}</td><td>{number(point.actualQuantity)}</td><td>{number(point.predictedQuantity)}</td><td>{number(point.error)}</td></tr>)}</Table> : <EmptyState message={t("noBacktest")} />}</Card></> : <EmptyPanel title={t("noForecast")} message={data.explanation} onAdd={generate} />}</AppShell>;
}