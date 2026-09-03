---
name: Phase 1 backend integration
description: Non-obvious Express 5 and Prisma composite-relation constraints encountered in the supply-chain backend.
---

Express 5 `Router.route(path)` returns a `Route` whose `.get()` signature accepts handlers, not another path string. Use `router.get(path, ...)` or mount a child router; passing `"/"` as the first argument is treated as a non-function handler.

**Why:** The Phase 1 route helper originally used a `Route` as if it were a `Router`, which prevented the application from starting.

**How to apply:** When extracting route-registration helpers, distinguish between `Router` and `Route` and test importing the route module during startup.

Prisma composite tenant relations that include a required organization field do not support nested writes with an explicit organizationId scalar when the parent relation is already supplying it. Product category/supplier composite references also require restrictive deletes rather than SET NULL while the organization component is required.

**Why:** Explicit nested organizationId fields caused runtime Prisma validation errors, and SET NULL generated schema warnings for required composite relation columns.

**How to apply:** Let nested order/transfer item creates inherit organization scope from their parent, and keep cross-organization composite references restrictive.