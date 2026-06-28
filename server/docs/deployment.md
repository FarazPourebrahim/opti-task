# Deployment & CI

How to run OptiTask in production and the continuous-integration pipeline.

> **No containerization is shipped** (per project decision — Docker is not used).
> The app is a standard Node service; deploy it on any host/PaaS that runs
> Node ≥ 22 with a reachable PostgreSQL. A `Dockerfile`/`compose` can be added
> later without code changes if that preference changes.

---

## Production run

### 1. Provision
- **Node.js ≥ 22** runtime.
- A **PostgreSQL** instance; set `DATABASE_URL`.
- Secrets via environment (never in code): `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET` (long random strings). The app **fails fast** at boot if
  these or `DATABASE_URL` are missing in production.

### 2. Build & migrate
```bash
cd server
npm ci                 # clean install (runs prisma generate)
npm run build          # → dist/
npm run migrate        # prisma migrate deploy (forward-only)
```

### 3. Start
```bash
NODE_ENV=production node dist/server.js
```
Serves GraphQL at `/graphql` (HTTP + WebSocket subscriptions) on `PORT`
(default 4000).

### 4. Health & readiness
Wire your load balancer / orchestrator to:
- **Liveness**: `GET /healthz` → 200 when the process is up.
- **Readiness**: `GET /readyz` → 200 when the DB is reachable, **503** otherwise
  (pull the instance out of rotation on 503).

### 5. Process & observability
- Run under a supervisor (systemd, PM2, or your PaaS) with restart-on-exit; the
  server handles `SIGINT`/`SIGTERM` for graceful shutdown (drains WS, closes DB).
- Logs are **structured JSON** (pino) on stdout — ship them to your log
  aggregator. Secrets are redacted.
- Set `LOG_LEVEL` (`info` default; `warn`/`error` for quieter prod).

### Environment variables
See the table in [`../README.md`](../README.md#2-configure-environment).

---

## Migrations
- Migrations are **forward-only** (Prisma Migrate). There are no per-step `down`
  migrations: to undo, author a corrective forward migration.
- **Always back up** before `npm run migrate` in production.
- `npm run migrate:reset` is **dev-only** — it drops and recreates the schema.

---

## Continuous integration

Run on every PR: **typecheck → lint → test → build**, with a PostgreSQL service
for the integration tests, and coverage thresholds enforced.

A ready-to-use GitHub Actions workflow is provided at
[`../ci/github-actions.ci.yml`](../ci/github-actions.ci.yml). Because CI config
lives at the repository root, copy it to `.github/workflows/ci.yml` (the repo
owner manages git/root):

```bash
mkdir -p .github/workflows
cp server/ci/github-actions.ci.yml .github/workflows/ci.yml
```

Pipeline stages:
1. Start PostgreSQL (service container) and export `DATABASE_URL`.
2. `npm ci` (in `server/`).
3. `npm run migrate` against the CI database.
4. `npm run typecheck` · `npm run lint`.
5. `npm run test:coverage` (fails if coverage thresholds aren't met).
6. `npm run build`.

Coverage thresholds are configured in `vitest.config.ts`
(lines/statements ≥ 80%, functions ≥ 75%, branches ≥ 72%).
