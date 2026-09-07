# SupplyQuest DZ

Phase 3 inventory-intelligence and demand-forecasting platform for Algerian SMEs, with a multi-tenant PostgreSQL backend, a Python analytics engine, and a React operations workspace.

## Implemented foundation and Phase 1

- React + TypeScript + Vite + Tailwind CSS frontend
- Node.js + Express + TypeScript REST API under `/api/v1/`
- PostgreSQL + Prisma relational foundation
- JWT authentication with bcrypt password hashing
- Server-side organization isolation and reusable RBAC middleware
- English, French, and Arabic locale switching with Arabic RTL support
- DZD, date, number, and Algerian wilaya utilities
- Deterministic synthetic demo seed data
- Products, categories, suppliers, customers, and warehouses
- Inventory levels, initial stock, adjustments, and movement history
- Purchase orders with partial/full receiving and atomic inventory updates
- Sales orders with stock-checked atomic completion
- Warehouse transfers with atomic transfer-in/transfer-out movements
- Organization-scoped APIs and frontend screens for all Phase 1 workflows
- API integration tests for auth, RBAC, tenant isolation, and transactional workflows
- Explainable inventory health, demand, coverage, aging, turnover, slow-moving, overstock, and ABC analytics
- Stockout risk, reorder points, replenishment recommendations, supplier performance, warehouse comparison, and deduplicated operational alerts
- Intelligence dashboard and detail screens at `/intelligence`, `/intelligence/inventory`, `/intelligence/suppliers`, `/intelligence/warehouses`, `/intelligence/recommendations`, and `/intelligence/alerts`
- Demand forecasting dashboard and product detail screens at `/forecasting` and `/forecasting/products/:id`
- Tenant-scoped forecast generation from PostgreSQL SALE transactions through a JSON Node-to-Python subprocess boundary
- Naive-last-value, 7-day moving average, and exponential smoothing candidates with chronological backtesting
- MAE, RMSE, safe MAPE, trend detection, basic weekly seasonality detection, explicit data sufficiency, honest quality states, and uncertainty intervals
- Persisted forecast runs, forecast points, backtest points, forecast history, performance summaries, and forecast-aware replenishment recommendations

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the implemented boundaries and decisions. [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) remains the product source of truth.

## Run locally

Replit provides `DATABASE_URL` for its managed PostgreSQL database. For another environment:

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name foundation
npm run db:seed
npm run dev
```

The app serves the frontend and API on port 5000. Run `npm test` for the API test suite and `npm run build` for the frontend/type-check build.

Seeded demo users share the development password `DemoPass123!`; their emails are documented by the seed output and are intended for local/demo use only.

## Phase 2 methodology

Analytics are calculated from PostgreSQL inventory levels and immutable transactions. Inventory value uses on-hand quantity × purchase price. Demand uses completed SALE transactions, with a trailing 14-day comparison for trend. Days of inventory is available quantity ÷ average daily demand. Reorder point is average daily demand × supplier lead time + safety stock, and recommendations add a 14-day review period.

All signals are business-rule/statistical indicators, not machine learning. The API marks insufficient history explicitly. Recommendation and alert status is persisted, while derived metrics stay dynamic. ABC uses sales-revenue contribution with 80%/95% cumulative thresholds. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full methodology and thresholds.

## Phase 3 forecasting methodology

Node/Express remains the authorization and API layer. It aggregates already tenant-scoped daily SALE quantities from PostgreSQL and passes JSON to `analytics/service.py`; Python never opens a database connection. Forecasts support 7, 14, and 30-day horizons. The engine fills missing days with zero demand, requires at least 14 non-zero days and 56 calendar days for a sufficient series, and marks shorter histories as `LIMITED` or `INSUFFICIENT` instead of silently presenting confidence.

Candidate models are intentionally simple and explainable: last observed value, 7-day moving average, and level-only exponential smoothing. When enough history exists, the engine withholds the final chronological holdout, calculates MAE/RMSE and MAPE that excludes zero-actual rows, and selects the lowest-RMSE candidate. Prediction intervals are only emitted when backtest RMSE supports them; otherwise the API reports that uncertainty is unavailable. These are operational forecasts, not guarantees or autonomous purchase orders.

Forecast runs and points are persisted for audit/history. A warehouse-specific forecast may extend the Phase 2 recommendation with lead-time demand, safety stock, and a 14-day review signal. Baseline recommendations remain available and are labeled separately from `FORECAST_AWARE` recommendations.

## Deferred phases

Machine learning, advanced time-series models, advanced executive BI, Supply Quest RPG presentation, and automated external integrations are intentionally deferred to later phases.

## License

MIT
