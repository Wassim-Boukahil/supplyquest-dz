---
name: Phase 3 forecasting boundary
description: Forecasting keeps authorization and persistence in Node while Python receives only tenant-scoped JSON demand history.
---

Node/Express is the authoritative forecasting boundary: it authenticates the request, verifies tenant-owned product and warehouse records, aggregates PostgreSQL SALE history, persists runs and points, and updates replenishment recommendations. Python is a deterministic JSON-in/JSON-out analytics process and never opens the database.

**Why:** This keeps tenant isolation and operational writes in one trusted service while avoiding unnecessary infrastructure or a second database.

**How to apply:** Add new forecasting methods behind the existing JSON contract and keep uncertainty/data-sufficiency states explicit rather than presenting unsupported confidence.