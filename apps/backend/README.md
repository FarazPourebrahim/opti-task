# OptiTask Backend

An AI-assisted Agile task-management platform exposed exclusively through a
**GraphQL API**, built on **Node.js + Express + Apollo Server v4 + PostgreSQL**
with a feature-based modular architecture, the repository pattern, a service
layer, and **Prisma** for data access and migrations.

> New here? Read **[docs/api-reference.md](docs/api-reference.md)** — it documents
> every query, mutation, and subscription, authentication, pagination, errors,
> and the AI/approval flow, so frontend and AI developers never need to read the
> source. The authoritative schema is **[docs/api/schema.graphql](docs/api/schema.graphql)**.

---

## Quick start

### Prerequisites
- **Node.js ≥ 22**
- **pnpm ≥ 9** — this is a pnpm workspace; npm/yarn would create a second
  lockfile and break the `@contracts` workspace link
- **PostgreSQL** running locally (or reachable via `DATABASE_URL`)

### 1. Install
Install once from the **repository root** — that links `@contracts` into this
app and runs `prisma generate` (postinstall):
```bash
pnpm install
```
Then work from this directory (`apps/backend`), or drive it from the root with
`ppnpm run backend-dev` / `backend-build` / `backend-start`.

### 2. Configure environment
Copy `.env.example` to `.env` and fill it in:
```bash
cp .env.example .env
```
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | prod (recommended in dev) | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | prod | — | Signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | prod | — | Signs refresh tokens |
| `JWT_ACCESS_TTL` | no | `15m` | Access-token lifetime |
| `JWT_REFRESH_TTL` | no | `7d` | Refresh-token lifetime |
| `PORT` | no | `4000` | HTTP/WS port |
| `LOG_LEVEL` | no | `info` | pino log level |
| `AI_REQUEST_TIMEOUT_MS` | no | `8000` | Per-call AI provider timeout |
| `AI_REQUEST_RETRIES` | no | `1` | AI provider retry attempts |

In **production** the app refuses to boot without `DATABASE_URL`,
`JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` (fail-fast env validation).

### 3. Migrate the database
```bash
pnpm run migrate:dev      # apply migrations to a fresh DB (dev)
pnpm run seed             # optional: demo org/project/team/sprint/tasks
```

### 4. Run
```bash
pnpm run dev              # tsx watch — http://localhost:4000/graphql
```
- **GraphQL HTTP**: `POST http://localhost:4000/graphql`
- **GraphQL subscriptions (WebSocket)**: `ws://localhost:4000/graphql`
- **Liveness**: `GET /healthz` · **Readiness** (checks DB): `GET /readyz`

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm run dev` | Run with hot reload (tsx watch) |
| `pnpm run build` | `tsc --noEmit && tsup` → bundled `dist/server.js` |
| `pnpm start` | Run the built server (`dist/server.js`) |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run lint` | ESLint over `src/` |
| `pnpm test` | Vitest (integration tests hit a real Postgres) |
| `pnpm run test:coverage` | Vitest with V8 coverage + thresholds |
| `pnpm run migrate:dev` | Apply a migration to the dev DB |
| `pnpm run migrate` | `prisma migrate deploy` (prod-safe, forward-only) |
| `pnpm run migrate:reset` | Drop + recreate the schema (dev only) |
| `pnpm run seed` | Seed demo data |
| `pnpm run schema:print` | Regenerate `docs/api/schema.graphql` |

---

## Architecture

Feature-based modular monolith. Each domain lives in `src/modules/<feature>/`
and is split by responsibility:

```
src/modules/<feature>/
├── graphql/
│   ├── <feature>.typeDefs.ts   # GraphQL SDL
│   └── <feature>.resolvers.ts  # transport only — no business logic
├── <feature>.service.ts        # business logic, authorization, transactions
├── <feature>.repository.ts     # database access only (Prisma)
├── <feature>.model.ts          # domain types / state machines
├── <feature>.validation.ts     # zod input validation
└── <feature>.test.ts           # colocated success/failure/invalid/authz tests
```

Imports inside the app use the `@/` alias (`@/shared/db`, `@/modules/task/...`).
A bare scope like `@contracts` always means a shared workspace package, so an
import line shows at a glance whether it crosses the app boundary.

Cross-cutting code lives in `src/shared/`:

| Folder | Responsibility |
|---|---|
| `config/` | Typed env loader (zod), fail-fast |
| `db/` | Prisma client singleton + `withTransaction` helper |
| `graphql/` | Schema composition, context, scalars, error formatter, DataLoaders, depth-limit |
| `auth/` | Password hashing (argon2), JWT, refresh rotation, RBAC engine |
| `events/` | In-process domain event bus (notifications) |
| `pubsub/` | In-process typed pub/sub (subscriptions) |
| `storage/` | Attachment storage adapter (swappable) |
| `errors/` | Typed `AppError` classes + safe error codes |
| `utils/` | Cursor pagination, sorting helpers |
| `logger/` | The pino instance + the typed security-event helper |
| `middleware/` | Rate limiting, per-request structured logging |
| `tests/` | Cross-feature end-to-end tests |

### Shared contracts (`@contracts`)

Anything both this API and a client must agree on lives in
`packages/contracts` and is imported as `@contracts`:

| Exported | Why it is shared |
|---|---|
| Domain enums (`TASK_STATUSES`, `PROJECT_STATES`, …) | One vocabulary for the DB, the SDL and the UI |
| `Connection` / `PageInfo` / page-size bounds | Every list query returns this exact shape |
| `ErrorCode` | Clients branch on `extensions.code`, never on a message |
| `RealtimeEvents` | Publisher and subscriber check against one payload map |
| `Role` / `Permission` | Lets a UI hide actions; the server still re-checks every one |

The package is pure types, enums and constants — no Node- or browser-only APIs —
so it compiles into both a server bundle and a browser bundle. The role→permission
**matrix** deliberately stays server-side: the vocabulary is shared, the authority
is not.

`src/shared/tests/contracts.test.ts` asserts every shared enum still matches the
Prisma schema exactly, so the two definitions cannot drift apart unnoticed.

### Modules
`auth · user · organization · project · team · task · activity · sprint · epic ·
comment · notification · ai · analytics · realtime`

### Request flow
```
HTTP/WS → Apollo/graphql-ws → resolver (transport)
        → service (authorize + business rules + transactions)
        → repository (Prisma) → PostgreSQL
```
DataLoaders (per request) batch relation reads to prevent N+1. Critical
mutations run in a transaction and write immutable `activity_logs`.

---

## Documentation index (`docs/`)

| Doc | For |
|---|---|
| [api-reference.md](docs/api-reference.md) | **Frontend & AI devs** — full API guide |
| [api/schema.graphql](docs/api/schema.graphql) | Generated SDL (authoritative schema) |
| [rbac.md](docs/rbac.md) | Roles × permissions matrix |
| [security.md](docs/security.md) · [security-checklist.md](docs/security-checklist.md) | Security principles + audit sign-off |
| [deployment.md](docs/deployment.md) | Production deploy + CI |
| [ROADMAP.md](docs/ROADMAP.md) | Build plan + progress |
| [known-debt.md](docs/known-debt.md) | Intentional shortcuts + right fixes |
| [ready.md](docs/ready.md) | Capability snapshot |
| [OptiTask.md](docs/OptiTask.md) | Product spec |

---

## Testing

Tests are colocated (`*.test.ts`) plus an end-to-end suite in
`src/shared/tests/`. Integration tests run against a **real PostgreSQL** via
`DATABASE_URL` and clean up after themselves by email/name tag. Run a focused
file with `pnpm exec vitest run src/modules/<feature>`.

---

## Git workflow

Open a branch from `backend/main` named for your task (e.g. `backend/OS1`);
merge and close it back into `backend/main` when the task is done.
