# SupplyQuest DZ

Phase 0 foundation for an intelligent, multi-tenant supply-chain management and business intelligence platform for Algerian SMEs.

> This project is under active development. Phase 1+ supply-chain workflows are intentionally not implemented yet.

## Phase 0 foundation

- React + TypeScript + Vite + Tailwind CSS frontend
- Node.js + Express + TypeScript REST API under `/api/v1/`
- PostgreSQL + Prisma relational foundation
- JWT authentication with bcrypt password hashing
- Server-side organization isolation and reusable RBAC middleware
- English, French, and Arabic locale switching with Arabic RTL support
- DZD, date, number, and Algerian wilaya utilities
- Deterministic synthetic demo seed data
- API integration tests for auth, RBAC, and cross-organization isolation

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

The app serves the frontend and API on port 5000. Run `npm test` for the Phase 0 API test suite and `npm run build` for the frontend/type-check build.

Seeded demo users share the development password `DemoPass123!`; their emails are documented by the seed output and are intended for local/demo use only.

## Deferred phases

Inventory transactions, purchasing and sales workflows, forecasting, advanced analytics, replenishment recommendations, Supply Quests, audit history, and the final BI dashboard belong to later phases.

## License

MIT
