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
- **PostgreSQL** running locally (or reachable via `DATABASE_URL`)

### 1. Install
```bash
cd server
npm install        # runs `prisma generate` automatically (postinstall)
```

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
npm run migrate:dev      # apply migrations to a fresh DB (dev)
npm run seed             # optional: demo org/project/team/sprint/tasks
```

### 4. Run
```bash
npm run dev              # tsx watch — http://localhost:4000/graphql
```
- **GraphQL HTTP**: `POST http://localhost:4000/graphql`
- **GraphQL subscriptions (WebSocket)**: `ws://localhost:4000/graphql`
- **Liveness**: `GET /healthz` · **Readiness** (checks DB): `GET /readyz`

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run with hot reload (tsx watch) |
| `npm run build` | `tsc -b && tsc-alias` → `dist/` |
| `npm start` | Run the built server (`dist/server.js`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src/` |
| `npm test` | Vitest (integration tests hit a real Postgres) |
| `npm run test:coverage` | Vitest with V8 coverage + thresholds |
| `npm run migrate:dev` | Apply a migration to the dev DB |
| `npm run migrate` | `prisma migrate deploy` (prod-safe, forward-only) |
| `npm run migrate:reset` | Drop + recreate the schema (dev only) |
| `npm run seed` | Seed demo data |
| `npm run schema:print` | Regenerate `docs/api/schema.graphql` |

---

## Architecture

Feature-based modular monolith. Each domain lives in `src/modules/<feature>/`
and is split by responsibility:

```
src/modules/<feature>/
├── <feature>.schema.ts      # GraphQL SDL (typeDefs)
├── <feature>.resolver.ts    # transport only — no business logic
├── <feature>.service.ts     # business logic, authorization, transactions
├── <feature>.repository.ts  # database access only (Prisma)
├── <feature>.model.ts       # domain types / state machines
├── <feature>.validation.ts  # zod input validation
└── <feature>.test.ts        # colocated success/failure/invalid/authz tests
```

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
| `middleware/` | Rate limiting |
| `tests/` | Cross-feature end-to-end tests |

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
file with `npx vitest run src/modules/<feature>`.

---

## Git workflow

Open a branch from `backend/main` named for your task (e.g. `backend/OS1`);
merge and close it back into `backend/main` when the task is done.
