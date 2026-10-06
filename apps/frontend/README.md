# OptiTask Frontend

The web client for the OptiTask GraphQL API: a React 19 single-page app on
Vite, with Apollo Client, generated GraphQL types, the
[Avero](https://avero-docs.vercel.app) component library on Tailwind CSS v4,
and `react-i18next`.

> Building on it? Read **[docs/HANDOFF.md](docs/HANDOFF.md)** first — where
> things are, the patterns to copy and the traps on the way. The build plan and
> its Definition of Done are in **[`CLIENT_PLAN.md`](../../CLIENT_PLAN.md)**.

---

## Quick start

### Prerequisites

- **Node.js ≥ 22** and **pnpm ≥ 9**. This is a pnpm workspace; npm or yarn
  would write a second lockfile and break the `@contracts` link.
- The **backend running** at the address in `.env` — see
  [`apps/backend/README.md`](../backend/README.md). The client has no mock
  mode: without the API nothing past the sign-in screen works.

### 1. Install

Once, from the **repository root**:

```bash
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
```

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000/graphql` | GraphQL over HTTP |
| `VITE_WS_URL` | `ws://localhost:4000/graphql` | GraphQL subscriptions |

Both are read at **build** time and end up in the bundle, so neither may ever
hold a secret. A missing or malformed value stops the app at boot with a
message saying which one.

The API only answers a browser whose origin is in its `CORS_ORIGINS`. The dev
and preview servers both use `http://localhost:5173`, which the backend allows
by default.

### 3. Run

```bash
pnpm run frontend-dev      # from the root — http://localhost:5173
```

---

## Scripts

Run from this directory, or from the root as `pnpm run frontend-<name>` for
`dev`, `build`, `preview`, `test`, `lint`, `typecheck` and `e2e`.

| Script | What it does |
|---|---|
| `dev` | Dev server with hot reload |
| `build` | Typecheck, then the production build into `dist/` |
| `build:check` | Checks `dist/`: Avero's styles made it in, no bare `@contracts` import, no source-map pointer, nothing shaped like a secret |
| `preview` | Serves `dist/` with the deployment's security headers |
| `verify` | Typecheck, lint, query-depth check and the unit suite — run before every commit |
| `typecheck` | `tsc` over the app and over the end-to-end suite |
| `lint` | ESLint, including the ban on arbitrary color values |
| `test` / `test:coverage` | Vitest; coverage fails below the floors in `vite.config.ts` |
| `codegen` | Regenerates `src/shared/graphql/generated` from the backend's SDL |
| `depth:check` | Fails if an operation nests deeper than the API's limit of 12 |
| `e2e` / `e2e:build` | The browser suite against the real backend, on the dev server or on the production build |

After changing any `*.operations.ts`: `pnpm run codegen`, then
`pnpm run depth:check`. The generated files are committed.

---

## Architecture

```
src/
├── App.tsx                 route tree only: lazy pages, guards, layout nesting
├── modules/<feature>/      one folder per feature
│   ├── <Feature>.page.tsx
│   ├── graphql/            every GraphQL document, in *.operations.ts
│   ├── hooks/              components call these, never useQuery directly
│   ├── components/  schemas/  utils/
│   └── <feature>.test.tsx
└── shared/                 used by more than one feature
    ├── components/         only what Avero does not provide
    ├── services/           apollo.client, realtime.client, session.store
    ├── lib/                apiError, capabilities
    ├── graphql/generated/  codegen output
    ├── i18n/locales/en.json
    └── tests/              the test harness
```

Data flows one way: **component → hook → operation → Apollo client**. Inside
the app, `@/…` is a file in this app and `@contracts` is the shared workspace
package.

A few rules hold everywhere:

- **The server decides.** Role checks in the client only hide controls; every
  mutation still handles `FORBIDDEN`.
- **No token in script-readable storage.** The session is two HTTP-only
  cookies. The socket's token lives in memory only.
- **Every string goes through `en.json`**, and its keys are type-checked.
- **Every list has an empty state, every wait a loading state, every failure a
  retry.**
- **Colors and sizes come from theme tokens**, never from a literal.

---

## Testing

Two suites, with different jobs.

**Unit and component tests** (`pnpm run test`) run in a simulated DOM with the
network mocked at the boundary by MSW. They are fast and cover behaviour:
what is sent, what is shown, what happens on each kind of failure. They cannot
see layout, real colors, a real drag or a real socket.

**End-to-end tests** (`pnpm run e2e`) drive a real browser against the real
backend, with nothing mocked:

| File | What it certifies |
|---|---|
| `e2e/journey.e2e.ts` | Register → organisation → project → sprint → task → comment → AI estimate → approve → analytics → sign out, all by clicking |
| `e2e/board.e2e.ts` | A card dragged with a real mouse, refused on an illegal column, moved by keyboard and by tap |
| `e2e/realtime.e2e.ts` | The socket against the real server: another person's changes arrive, two people see each other, the app works with the socket down |
| `e2e/keyboard.e2e.ts` | Signing in, the skip link, the command palette, a dialog's focus trap and creating an organisation, with no pointer |
| `e2e/session.e2e.ts` | Cookies are HTTP-only, nothing readable holds a token, a reload and two simultaneous tabs keep the session |
| `e2e/sweep.e2e.ts` | Every screen at desktop and phone width: no refused request, nothing thrown, no sideways overflow, and a full `axe` audit |

They need PostgreSQL reachable through the backend's `.env`, and they **write
to that database**: each run registers its own users under
`@e2e.optitask.test`. Both servers are started for you if they are not already
up. The suite paces itself under the API's rate limit, so a full run takes
about nine minutes.

```bash
pnpm run e2e                      # against the dev server
pnpm run e2e:build                # against the production build
pnpm exec playwright test board   # one file
```

The suite uses the Chrome already installed. Set `E2E_BROWSER_CHANNEL=msedge`
for Edge, or to an empty value to use Playwright's own Chromium
(`pnpm exec playwright install chromium`).

---

## Documentation

| Doc | For |
|---|---|
| [docs/HANDOFF.md](docs/HANDOFF.md) | Anyone picking the work up: state, code map, patterns, traps |
| [docs/deployment.md](docs/deployment.md) | Building, hosting, headers and the release checklist |
| [docs/known-debt.md](docs/known-debt.md) | Every shortcut taken, with its right fix |
| [`CLIENT_PLAN.md`](../../CLIENT_PLAN.md) | The phase plan, Definition of Done and API coverage matrix |
| [`apps/backend/docs/api-reference.md`](../backend/docs/api-reference.md) | The API this client speaks to |
