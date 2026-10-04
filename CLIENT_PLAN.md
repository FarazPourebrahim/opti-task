# OptiTask Frontend — CLIENT_PLAN

The 0 → 100 build plan for `apps/frontend`, the web client for the OptiTask
GraphQL API. This document is the **execution contract**: it sequences the work,
fixes the conventions, and defines a **strict, binary Definition of Done** for
every task. Nothing is "done" until the DoD for it is checked off here.

Derived from `.claude/CLAUDE.md` (working agreement), `apps/backend/docs/api-reference.md`,
`apps/backend/docs/rbac.md`, `apps/backend/docs/known-debt.md`, and the
authoritative SDL at `apps/backend/docs/api/schema.graphql`.

---

## How to use this document

- Work proceeds in **phases**. Each phase has a **task tracker** (every task has
  an ID like `F8.3`) and an **Exit Criteria** block that is the phase's DoD.
- Update the task's `Status` cell **and** the phase's exit checkboxes **in the
  same commit** as the code. A phase is not complete while its tracker lags.
- Status legend: `⬜ not started` · `🚧 in progress` · `✅ done` · `⛔ blocked`
  · `➖ n/a`.
- A task may only move to `✅` when **every** item in the Global DoD below passes
  for it, plus its phase's exit criteria.
- **Branching**: cut from `frontend/main`, name the branch for the task
  (`frontend/F8.3`), merge back into `frontend/main`. Integration lands on `dev`;
  releases merge `dev` → `main`.
- **Commits**: `type(Scope): Title-Style Description` — e.g.
  `feat(Task): Add Board Column Drag Handles`. Commit in appropriate chunks,
  never one commit per phase.

---

## Locked decisions

These were decided up front. They are binding; changing one is a documented
amendment to this file, not an in-flight improvisation.

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Framework | **React 19 + TypeScript (strict) on Vite** | SPA fork (Fork A) of the working agreement. No Next.js, no Server Components. |
| D2 | Styling | **Tailwind CSS v4 + Avero design tokens** *(amended — A1)* | Avero ships no precompiled stylesheet, so Tailwind must scan its compiled output. Feature layout is written in Tailwind utilities against the same theme tokens. No CSS Modules, no CSS-in-JS. |
| D3 | Data layer | **Apollo Client** | Backend is Apollo Server v4, GraphQL-only. Normalized cache plus a built-in `graphql-ws` link for the 5 subscriptions. |
| D4 | Auth transport | **HTTP-only cookies for HTTP; in-memory access token for the WebSocket only** | Cookies satisfy the rule that tokens never touch JS-readable storage; `graphql-ws` needs `connectionParams`, so the token lives in a module-scoped variable — never `localStorage`/`sessionStorage`. |
| D5 | Component layer | **Avero (`@averoui/react`)** *(amended — A1)* | Radix-based, so focus traps, keyboard nav and ARIA stay correct by construction. Primitives are imported straight from the package; `shared/components` holds only what Avero lacks. |
| D6 | Scope | **Full parity** — every query, mutation and subscription reachable from the UI | The backend is 100% complete; nothing should be stranded. Coverage is proven by the matrix in Appendix A. |
| D7 | Typing | **GraphQL Code Generator (`client-preset`)** against `apps/backend/docs/api/schema.graphql` | One canonical type per contract; no hand-written response types, no casts on server data. |
| D8 | i18n | **`react-i18next`, `en` locale, from Phase 1** | The working agreement demands full localization or none. `ApiError` carries i18n keys, not messages — load-bearing, not polish. |
| D9 | Theme | **Light only** *(added — A1)* | Avero ships a light theme and has no dark variants in its components. Dark mode returns only if Avero gains it upstream. |
| D10 | Brand color | **Amber** *(added — A1)* — `apps/frontend/colors.md` | Set once as `--color-primary` / `--color-primary-hover` in `global.css`; Avero derives its tints from them. |

---

## Amendment A1 — Avero replaces the in-house component layer (2026-10-04)

After a revision the team chose **Avero** (`@averoui/react`,
<https://avero-docs.vercel.app>) as the component library, as a **full
replacement**: the Radix-plus-CSS-Modules primitives from Phase 2 and the token
layer from Phase 1 are gone, not wrapped. This amends D2 and D5 and adds D9 and
D10. Phases 1 and 2 below are kept as a record of what was built and are marked
superseded.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| A1.1 | Swap dependencies: add `@averoui/react`, `@averoui/tokens`, `tailwindcss` v4, `@tailwindcss/vite`; remove every `@radix-ui/*` package, `cmdk` and `react-day-picker` | ✅ |
| A1.2 | `global.css` — Tailwind + Avero `theme.css` / `base.css` / `utilities.css`, `@source` pointing at Avero's `dist`, fonts kept on Inter / JetBrains Mono | ✅ |
| A1.3 | Brand tokens: amber primary from `colors.md`; warning moved to orange so it cannot be mistaken for the brand | ✅ |
| A1.4 | `AveroProvider locale="en-US"` and Avero's `ToastProvider` in `AppProviders` | ✅ |
| A1.5 | Remove the 20 in-house primitives, the six token stylesheets, the theme context, the pre-paint theme script and both dev galleries | ✅ |
| A1.6 | Rebuild the auth screens (login, register, forgot password, accept invitation, sessions, change password) on Avero + Tailwind | ✅ |
| A1.7 | `shared/components`: `FormField` (the one field composition every form uses) and `ErrorState` (Avero has none); `ErrorBoundary` kept | ✅ |
| A1.8 | Tests for the new shared components; obsolete primitive, token and theme suites removed | ✅ |
| A1.9 | This plan and `known-debt.md` reconciled | ✅ |

### Verified

- `typecheck`, `lint`, the query-depth check and `test` are green (97 tests,
  10 files). The count dropped because the suites for the deleted primitives,
  tokens and theme went with them; Avero's primitives are covered by its own
  suite.
- `build` succeeds and the compiled stylesheet contains Avero's classes
  (`bg-primary-hover`, `rounded-3xl`) and the amber `--color-primary` — so
  `@source` is doing its job. Without it the components render unstyled.
- **Bundle, new Phase 14 baseline**: JS ≈ 187 kB gzip, CSS ≈ 21.8 kB gzip
  (was ≈ 118 kB / 6.9 kB). Fonts unchanged.

### Not verified

- Nothing has been looked at in a browser. The auth screens are not routed
  until Phase 5, so there is no screen to open yet; the first visual pass
  belongs to F5.2.
- ~~Avero's `DatePicker` has not been checked against the API's requirement
  for full RFC-3339 values.~~ Checked in Phase 8: it reports `YYYY-MM-DD`, which
  `dateInputToApi` turns into a full instant. Asserted end to end in the create
  task test.

### Open items — need a change in Avero itself

1. **White text on the amber primary button.** Avero hard-codes `text-white`
   on `bg-primary`. Against this amber that is about 2:1 (about 3:1 on hover),
   far below the 4.5:1 the Global DoD requires. The agreed fix is upstream: a
   `--color-primary-foreground` token that the filled variants read.
2. **Warning tones are hard-coded amber.** `--color-warning` only drives the
   `warning` Button variant. `Alert`, `Toast` and `Badge` use Tailwind's
   `amber-*` palette directly, so a warning alert still reads as the brand
   color. They should read the warning tokens.
3. **No dark theme** (D9).

---

## Backend contract — the facts the client must obey

Verified against the SDL and backend source, not assumed.

| Fact | Consequence for the client |
|---|---|
| **Endpoints**: `POST /graphql`, `ws://…/graphql`, `GET /healthz`, `GET /readyz` | Two links in Apollo, split on operation type. |
| Auth cookie names are **`optitask_access` / `optitask_refresh`** — *not* `access_token` as `api-reference.md` claims | They are `HttpOnly`; the client never reads them. Documented so nobody wastes time looking. |
| Auth precedence: `Authorization: Bearer` **wins over** the cookie | Never send a stale header on HTTP — omit it entirely and let the cookie work. |
| `refreshToken(refreshToken: String)` — the arg is **optional**, falls back to the refresh cookie | Call it with **no arguments**; the browser supplies the cookie. |
| Cookies are `SameSite=Lax`, `Secure` in production | Fine in dev (`localhost:5173` → `localhost:4000` is same-site) and in prod on a shared registrable domain. A genuinely cross-site deployment needs `SameSite=None; Secure` **plus** a CSRF token — see Risk R2. |
| **`extensions` carries `code` and nothing else** — no `fieldErrors`, no `details` | The server cannot drive per-field form errors. The client mirrors backend validation in its own zod schemas and renders `BAD_USER_INPUT` as a **form-level** error. |
| Error codes: `UNAUTHENTICATED` `FORBIDDEN` `NOT_FOUND` `BAD_USER_INPUT` `CONFLICT` `SERVICE_UNAVAILABLE` `INTERNAL_SERVER_ERROR` | Branch on `extensions.code` only. Never match message text. |
| `x-request-id` is an **HTTP response header**, not in `extensions` | A custom Apollo link reads it off the response and attaches it to `ApiError` so users can quote it in support. |
| **Query depth is capped at 12** | Fragment discipline is mandatory; a deeply nested generated document is a runtime validation error, not a slow query. |
| Pagination: `first` default 20, **max 100**; `after` is an opaque base64 cursor | Never request more than 100. Never parse or construct a cursor. |
| `DateTime` **rejects date-only strings** | Every date input must emit full RFC-3339 (`2026-03-01T00:00:00.000Z`). |
| `Task.sprintId` / `Task.epicId` are **raw IDs**, not object relations | Resolve names from the project's sprint/epic lists via the Apollo cache. Do not expect `task.sprint.name`. |
| Password policy: 8–100 chars, at least one letter, at least one number; email trimmed and lowercased | Mirror exactly in the client zod schema (Phase 4). |
| Roles/permissions vocabulary is in `@contracts`; **the matrix is server-side only** | The client cannot compute permissions. It derives *capability hints* from the user's role on the resource to hide actions, and **every** action still handles `FORBIDDEN` gracefully. |
| `requestPasswordReset` is a **no-op stub** (known-debt) | The UI must not promise an email. |
| Attachments store metadata only — **no bytes are uploaded or served** (known-debt) | Model attachments as metadata records. No upload dropzone that pretends to work. |
| The `users` query is **unscoped** — it lists every user in the system (known-debt) | Never use it for people-pickers. Use `Project.members`, `Team.members`, or `assignmentContext.candidates`. |

---

## Prerequisites — backend changes ✅ done

These blocked the chosen auth model and have been resolved on the backend
(branch `backend/CORS`, 5 commits, 12 new tests).

| # | Blocker | Resolution | Status |
|---|---|---|:--:|
| P1 | `cors({ credentials: true })` defaulted to `origin: '*'`. A browser **rejects** `Access-Control-Allow-Origin: *` on a credentialed request, so `credentials: 'include'` failed every call. | `shared/middleware/cors.ts` reflects one allowed origin at a time from a validated `CORS_ORIGINS` allowlist; required in production, defaulted to the Vite dev origins otherwise. | ✅ |
| P2 | No `Origin` validation and no CSRF control on state-changing POSTs beyond `SameSite=Lax`. | `shared/middleware/csrf.ts` requires a non-empty `x-optitask-client` header **and** an allowlisted `Origin` — but only for cookie-authenticated requests. `Authorization: Bearer` and unauthenticated callers are exempt, so curl and server-to-server clients are unaffected. Rejections log the `csrf.rejected` security event. | ✅ |
| P3 | `x-request-id` was set but not exposed, so JS could not read it cross-origin. | `exposedHeaders: ['x-request-id']` on the CORS config. | ✅ |

The CSRF design deliberately checks only that a custom header is *present*, not
its value: the security property is that a cross-site `<form>` cannot set one at
all, and checking the value would couple the API to a client version for no gain.

---

## Target architecture

```
apps/frontend/
├── index.html
├── package.json                 # name: optitask-frontend
├── tsconfig.json                # strict + paths: @/* and @contracts
├── vite.config.ts               # resolve.alias mirrors tsconfig paths
├── codegen.ts                   # reads ../backend/docs/api/schema.graphql
├── .env.example
└── src/
    ├── main.tsx                 # bootstrap only
    ├── App.tsx                  # router tree — path → page. No business logic.
    ├── modules/
    │   ├── auth/                # Login.page.tsx, Register.page.tsx, Sessions.page.tsx
    │   ├── user/                # Profile.page.tsx, skills, expertise
    │   ├── organization/        # Organizations.page.tsx, members, invitations
    │   ├── project/             # Projects.page.tsx, ProjectSettings.page.tsx
    │   ├── team/                # Teams.page.tsx
    │   ├── task/                # Board.page.tsx, TaskList.page.tsx, TaskDetail.page.tsx
    │   ├── sprint/              # Sprints.page.tsx, SprintDetail.page.tsx (burndown)
    │   ├── epic/                # Epics.page.tsx, milestones
    │   ├── comment/             # comment thread + attachments (inside task detail)
    │   ├── notification/        # NotificationFeed, bell popover
    │   ├── ai/                  # AiRecommendations.page.tsx, approval flow
    │   └── analytics/           # ProjectAnalytics.page.tsx, UserAnalytics
    └── shared/
        ├── components/          # only what Avero lacks (FormField, ErrorState, ErrorBoundary…)
        ├── hooks/               # useDebounce, useMediaQuery…
        ├── services/            # apollo.client.ts, realtime.client.ts, session.store.ts
        ├── lib/                 # apiError.ts, capabilities.ts
        ├── graphql/generated/   # codegen output (committed)
        ├── types/               # app-internal shared types
        ├── utils/               # formatDate.ts, cursor helpers…
        ├── constants/           # api.constants.ts, ui.constants.ts
        ├── context/             # AppProviders.tsx, apollo.context.tsx
        ├── i18n/                # config + en.json
        ├── routes/              # route path constants + helpers
        ├── styles/              # global.css — Tailwind + Avero tokens + brand overrides
        └── tests/               # cross-feature tests, MSW server, render helper
```

**Module layout** (create only the subfolders a feature actually uses):

```
modules/<feature>/
├── <Feature>.page.tsx
├── components/          # PascalCase.tsx, styled with Tailwind utilities
├── hooks/               # use<Thing>.ts
├── graphql/             # <domain>.operations.ts
├── schemas/             # <feature>.schema.ts (zod, form input only)
├── types/               # <feature>.types.ts
├── utils/               # <feature>.utils.ts
└── <feature>.test.tsx
```

**Alias discipline**: `@/…` means *this app*. `@contracts` means *the shared
workspace package*. Never cross the streams.

---

## Global Definition of Done

**Every task in every phase must satisfy all of these.** A task that fails any
line is not done, regardless of whether the feature "works".

### Correctness
- [ ] `pnpm --filter optitask-frontend run typecheck` → **0 errors**, with test
      files **included** in the typecheck (do not repeat the backend's `exclude` debt).
- [ ] `pnpm --filter optitask-frontend run lint` → **0 errors, 0 warnings**.
- [ ] `pnpm --filter optitask-frontend run test` → green.
- [ ] `pnpm --filter optitask-frontend run build` → succeeds.
- [ ] No `any` outside a `// BOUNDARY:` comment naming the third-party cause and
      the replacement.
- [ ] No cast on server response data. Types come from codegen.

### Architecture
- [ ] `App.tsx` contains only path → page mapping, guards and layout nesting.
      Zero business logic, zero data fetching.
- [ ] Data flows **Component → hook → operation → Apollo client**. No component
      calls `useQuery`/`useMutation` on a raw document; it calls a feature hook.
- [ ] No GraphQL document defined outside a
      `modules/<feature>/graphql/*.operations.ts` file (or `shared/graphql/`).
- [ ] Presentational components take props and render. No side effects, no fetching.
- [ ] Nothing feature-specific in `shared/`. Nothing app-specific in `packages/contracts`.

### UI quality
- [ ] Primitives come from `@averoui/react`. Nothing in `shared/components`
      duplicates a component Avero already provides.
- [ ] Styling is Tailwind utilities against theme tokens. No arbitrary color
      values (`text-[#…]`, `bg-[rgb(…)]`) and no inline `style` colors.
- [ ] **Every** list/query that can return zero items renders a dedicated
      `EmptyState` (icon or illustration + message + next action where one exists).
      "No results for this filter" and "nothing here yet" are distinct states.
- [ ] **Every** async operation over ~100ms shows a loading state, visually
      distinct from the empty state. Full-page → skeleton; inline action →
      spinner on that control only; async buttons disable and spin while pending.
- [ ] Every loading state that can fail resolves into an explicit error state with
      a retry affordance. No spinner runs forever.
- [ ] Every user-facing string goes through i18n. No bare literals in JSX.
- [ ] No `alert()`, `prompt()` or `confirm()` — use `Toast` and `ConfirmDialog`.

### Accessibility
- [ ] Keyboard-operable end to end; visible focus ring on every interactive element.
- [ ] `axe` reports **0 violations** on the touched screens.
- [ ] Correct semantic landmarks and labels; icon-only buttons have accessible names.
- [ ] Respects `prefers-reduced-motion`.
- [ ] Renders correctly in the light theme — the only one (D9).

### Responsiveness
- [ ] Usable from 360px to 1920px. No horizontal body scroll at any width.
- [ ] Tables, boards and charts each get their own `overflow-x: auto` container.

### Security
- [ ] No token, secret or PII in `localStorage`, `sessionStorage`, a URL, or a log.
- [ ] No `dangerouslySetInnerHTML` without a sanitizer and a `// BOUNDARY:` note.
- [ ] Every mutation's failure path handles `FORBIDDEN` and `UNAUTHENTICATED`
      without a crash or a dead-end screen.
- [ ] Capability hints only **hide** actions — they never substitute for the
      server's check.

### Testing
- [ ] Tests are Arrange / Act / Assert and colocated as `<feature>.test.tsx`.
- [ ] Network is mocked at the boundary with **MSW**, never by mocking a module.
- [ ] Each feature covers: success, a `BAD_USER_INPUT` failure, a `FORBIDDEN`
      failure, and a network failure.
- [ ] No `.only()` or `.skip()` left behind.

### Documentation
- [ ] This tracker updated in the same commit.
- [ ] Any intentional shortcut logged in `apps/frontend/docs/known-debt.md` with
      **what / why / right fix / impact**.

---

## Progress tracker

| Phase | Title | Cumulative % | Status |
|---|---|---|:--:|
| 0 | Foundations & Tooling | 6% | ✅ |
| 1 | Design System & Theming | 14% | ✅ |
| 2 | Shared Component Library | 24% | ✅ |
| 3 | GraphQL Data Layer & Codegen | 32% | ✅ |
| 4 | Auth & Session | 40% | ✅ |
| A1 | Avero Migration (amendment) | 40% | ✅ |
| 5 | App Shell, Routing & Guards | 47% | ✅ |
| 6 | Organization & Members | 54% | ✅ |
| 7 | Project & Team | 61% | ✅ |
| 8 | Task — Board, List & Detail | 72% | ✅ |
| 9 | Sprint & Epic | 79% | ✅ |
| 10 | Collaboration — Comments & Attachments | 85% | ⬜ |
| 11 | Notifications & Realtime | 90% | ⬜ |
| 12 | AI Recommendations & Approval | 95% | ⬜ |
| 13 | Analytics | 98% | ⬜ |
| 14 | Hardening, A11y, Perf & Release | 100% | ⬜ |

**Current overall progress: 79%** (Phases 0–9 and Amendment A1 complete).

**Critical path:** 0 → 1 → 2 → 3 unlock everything. 4 → 5 gate all authenticated
screens. 6 → 7 feed 8. 8 feeds 9/10/12. 11 depends on 8–10. 13 depends on 8–9.
14 closes out.

---

# Phase 0 — Foundations & Tooling — 0 → 6%

**Goal:** A compiling, lintable, testable React + TS skeleton inside the pnpm
workspace that renders a blank shell and resolves `@contracts` at runtime.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F0.1 | Scaffold `apps/frontend` (Vite 6 + React 19 + TS), package name `optitask-frontend` | ✅ |
| F0.2 | `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, paths `@/*` → `src/*` **and** `@contracts` → `../../packages/contracts/src/index.ts`; tests **included** in the typecheck | ✅ |
| F0.3 | `vite.config.ts`: mirror both aliases in `resolve.alias` (the `@contracts` known-debt trap); one config drives dev, build and vitest | ✅ |
| F0.4 | Add `@contracts: workspace:*` dependency; verify the pnpm link | ✅ |
| F0.5 | ESLint + Prettier: `no-console`, `no-alert`, no-`any` with `// BOUNDARY:` escape, import-order, `jsx-a11y`, no relative cross-app imports | ✅ |
| F0.6 | Vitest 3 + React Testing Library + jsdom + `@testing-library/jest-dom` + `jest-axe` | ✅ |
| F0.7 | MSW: `shared/tests/server.ts` (unhandled request = error) + a `renderWithProviders` provider seam | ✅ |
| F0.8 | `shared/config/env.ts` — zod-validated `VITE_API_URL` / `VITE_WS_URL`, fails fast at boot; `.env.example` | ✅ |
| F0.9 | Root `package.json`: `frontend-dev`, `frontend-build`, `frontend-preview`, `frontend-test`, `frontend-lint`, `frontend-typecheck` | ✅ |
| F0.10 | Smoke test: app mounts, and a test importing `@contracts` passes | ✅ |
| F0.11 | `shared/lib/bootFailure.ts` + dynamic-import bootstrap so a bad `.env` renders the cause instead of a blank page | ✅ |

### Exit criteria (DoD)

- [x] `pnpm install` from the **repo root** links `@contracts`
      (`apps/frontend/node_modules/@contracts → packages/contracts`); no second
      lockfile exists.
- [x] `pnpm run frontend-typecheck` → 0 errors, **including** `.test.tsx` files.
- [x] `pnpm run frontend-lint` → 0 errors, 0 warnings.
- [x] `pnpm run frontend-test` → green (15 tests, 4 files).
- [x] `pnpm run frontend-build` → succeeds, and `@contracts` is **inlined** into
      the bundle. Verified with a temporary probe module: the bundle contained
      `"BACKLOG","TODO","IN_PROGRESS"` and **no** bare `@contracts` specifier.
      (The probe was removed; the trivial "no bare specifier" grep alone would
      have passed vacuously, since nothing imports `@contracts` yet.)
- [x] `pnpm run frontend-dev` serves the shell with HMR (`/@react-refresh`
      injected); `HTTP 200` on `/` and on `/src/shared/config/env.ts`.
- [x] Importing `@contracts` resolves in **all four** contexts: `tsc`,
      `vite dev`, `vite build`, `vitest`. Each verified explicitly.
- [x] Booting with a missing/invalid `VITE_API_URL` fails loudly with a readable
      message — it does not silently render a broken app. A module-scope throw
      alone would have left a blank page, so `main.tsx` uses dynamic imports and
      renders the cause via `renderBootFailure` (asserted in `bootstrap.test.tsx`,
      including the XSS-safe and non-`Error` paths).

---

# Phase 1 — Design System & Theming — 6 → 14%

> **Superseded by Amendment A1.** The token stylesheets, both themes, the theme
> context and the token gallery described here were removed; tokens now come
> from `@averoui/tokens`. i18n (F1.11) and `AppProviders` (F1.13) remain.

**Goal:** The complete token layer and both themes, before a single feature
component exists. This is where "clean and premium" is decided.

**Design direction:** dark-first, near-neutral slate grayscale with a single
saturated accent hue; generous whitespace on an 8px rhythm; restrained borders
with elevation carried by soft blurred shadows rather than heavy strokes; one
variable UI typeface plus a mono face for IDs, cursors and code.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F1.1 | `shared/styles/resets.css` — the global reset from the working agreement | ✅ |
| F1.2 | `colors.css` — grayscale `--color-gray-100` (white) → `--color-gray-10` (near-black) on a consistent ladder | ✅ |
| F1.3 | `colors.css` — semantic families `primary`, `accent`, `success`, `warning`, `danger`, `info`, each with `-opposite`, `-lighter`, base, `-darker` (one hue/saturation, lightness varies) | ✅ |
| F1.4 | `colors.css` — surface/text/border tokens remapped under `body.light` / `body.dark` | ✅ |
| F1.5 | `typography.css` — `--fs-100`…`--fs-900`; self-hosted variable fonts via `@fontsource-variable` (no CDN); weight + line-height + letter-spacing tokens | ✅ |
| F1.6 | `measures.css` — `--br-*`, `--space-*`, `--bw-*` and layout ceilings on the same numeric convention | ✅ |
| F1.7 | `shadows.css` — `--shadow-*` and `--shadow-blur-*`, each blur tier **visibly softer and larger-spread** than its base counterpart | ✅ |
| F1.8 | `animations.css` — `--animation-duration-*`, easing tokens, `prefers-reduced-motion` kill-switch | ✅ |
| F1.9 | `global.css` — imports in dependency order (fonts + reset + tokens first), sets only document-level defaults | ✅ |
| F1.10 | `theme.context.tsx` — honors `prefers-color-scheme`, persists the choice, applies `body.light`/`body.dark`, no flash of wrong theme | ✅ |
| F1.11 | `shared/i18n/` — `react-i18next` + `en.json` with **compile-checked keys** via module augmentation | ✅ |
| F1.12 | Dev-only `#/dev/tokens` gallery rendering every token in both themes | ✅ |
| F1.13 | `AppProviders` — one provider tree shared by the app and the test harness | ✅ |
| F1.14 | Standing CI guard: no raw colors/sizes/durations in any `*.module.css` (risk R10) | ✅ |

### Exit criteria (DoD)

- [x] No raw color, size or duration in any `*.module.css` — enforced by a test
      that walks every module stylesheet, not a one-off grep. Verified to
      **fail** on an injected `#ff0000` before being accepted.
- [x] HSL syntax is consistent across every token file — comma form only
      (asserted; the check reads declarations, not comments).
- [x] No token exists outside the defined scales; every scale is asserted to
      ascend at each step, and adjective names (`-fast`, `-lg`) are banned by test.
- [x] Every `--shadow-blur-N` differs from `--shadow-N` at the same step **and**
      has a strictly larger blur radius (asserted per step).
- [x] `#/dev/tokens` renders the full palette, type scale, spacing, radii,
      shadows and durations — asserted token-by-token against the inventory, so
      a token missing from the gallery fails the suite. `axe` reports **0
      violations** in both themes.
- [x] Theme choice survives a reload with no flash of the wrong theme: an inline
      pre-paint script applies the class before the module bundle, asserted to
      appear **before** `main.tsx` in `index.html` and to share the storage key.
- [x] With `prefers-reduced-motion: reduce`, every duration token collapses and
      all animation/transition durations are forced to 0.01ms (asserted).
- [x] Contrast **measured**, not eyeballed: 22 pairs across both themes plus all
      6 semantic `-opposite` pairings. Text ≥ 4.5:1, UI borders and focus ring
      ≥ 3:1. The first run failed on both border tokens; `--color-border-400`
      was retuned to `--color-gray-50` (now 3.05–4.41:1).
- [x] i18n is wired, keys are **compile-checked** (an unknown key is a type
      error), and the gallery reads every label from `en.json`.

> **Not verified by me:** the gallery is asserted structurally and for
> accessibility, but I have not looked at it in a browser. Run
> `pnpm run frontend-dev` and open `http://localhost:5173/#/dev/tokens` to judge
> the palette by eye before Phase 2 builds components on top of it.

---

# Phase 2 — Shared Component Library — 14 → 24%

> **Superseded by Amendment A1.** These primitives were removed in favour of
> `@averoui/react`. The happy-dom test environment (F2.0) and `ErrorBoundary`
> (F2.7) remain.

**Goal:** Every primitive a feature will need, accessible by construction and
styled only with Phase 1 tokens. Features must never invent a primitive.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F2.0 | Test environment able to run Radix floating surfaces (happy-dom + polyfills + shared `auditA11y`) | ✅ |
| F2.1 | Form: `Button`, `IconButton`, `Input`, `Textarea`, `Field` (label + hint + error), `Checkbox`, `RadioGroup`, `Switch` | ✅ |
| F2.2a | Overlays: `Modal`, `Drawer`, `ConfirmDialog` (with focus return) | ✅ |
| F2.2b | Triggers: `DropdownMenu`, `ContextMenu`, `Popover`, `Tooltip` | ✅ |
| F2.2c | Radix-backed: `Select`, `Combobox`, `Tabs`, `SegmentedControl` | ✅ |
| F2.3 | `Toast` + `ToastProvider` — the only channel for transient messages | ✅ |
| F2.4 | Display: `Avatar`, `AvatarGroup`, `Badge`, `Chip`, `Card`, `Table`, `Breadcrumbs`, `ProgressBar`, `Kbd` | ✅ |
| F2.5 | State: `Skeleton`, `SkeletonList`, `Spinner`, `EmptyState`, `ErrorState`, `LoadMore` | ✅ |
| F2.6 | `DatePicker` emitting **full RFC-3339** strings | ✅ |
| F2.7 | `ErrorBoundary` with reset-on-route-change | ✅ |
| F2.8 | Dev-only `#/dev/components` gallery covering every primitive and every state | ✅ |
| F2.9 | A test per primitive: renders, keyboard path, disabled/loading/error states | ✅ (220 tests total) |
| F2.10 | `shared/components/index.ts` barrel — features import from one place | ✅ |

### Exit criteria (DoD)

- [~] Every primitive renders in both themes — asserted structurally and by axe
      in light **and** dark. **Not** visually verified, and 360px/1920px layout
      is unverified: happy-dom performs no layout. Logged in known-debt as the
      largest gap in this phase.
- [x] `Dialog`, `Drawer`, `Menu`, `Select` and `Popover` each pass a keyboard
      test: open, navigate, `Esc` closes, focus **returns to the opener**. Focus
      trap asserted for `Modal` by tabbing 6 times and checking containment.
      `Combobox` covered by open → type → filter → select.
- [x] `axe` reports **0 violations** across the whole `#/dev/components` gallery,
      in both themes (`region`/`aria-hidden-focus` excluded — see known-debt).
- [x] `EmptyState` requires an icon and a title in its type signature, so a bare
      "No data" string cannot be constructed.
- [x] `DatePicker` emits `2026-03-15T00:00:00.000Z`-shaped values; tests assert a
      date-only string is never produced and that local time-of-day cannot shift
      the calendar day.
- [x] No `alert(` / `prompt(` / `confirm(` calls; `no-alert` is enforced by lint.
      (Two grep hits are a doc comment and an XSS test payload.)
- [x] Every component's `.module.css` opens with a comment mapping its JSX tree,
      and the nesting follows it.
- [x] Zero raw values in any component CSS — enforced by a test that walks all
      20 module stylesheets, proven to fail on an injected value.
- [x] **Bundle measured**: 5 JS chunks ≈ 118 kB gzip, 3 CSS files ≈ 6.9 kB gzip
      (~125 kB total), plus self-hosted font subsets (Inter latin 48 kB,
      JetBrains Mono latin 40 kB), fetched per glyph range. Recorded here as the
      Phase 14 baseline.

---

# Phase 3 — GraphQL Data Layer & Codegen — 24 → 32%

**Goal:** One typed, normalized, error-normalizing client. After this phase, no
feature ever thinks about transport.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F3.1 | `codegen.ts` — `client-preset` against `apps/backend/docs/api/schema.graphql`; scalar map `UUID→string`, `DateTime→string`, `JSON→Record<string, unknown>` | ✅ |
| F3.2 | `shared/services/apollo.client.ts` — split link: `HttpLink` (`credentials: 'include'`, `x-optitask-client` header) for query/mutation, `GraphQLWsLink` for subscriptions | ✅ |
| F3.3 | `shared/lib/apiError.ts` — `ApiError extends Error` with `kind`, `status`, `requestId`, `messageKey`; `code → kind → i18n key` mapping table | ✅ |
| F3.4 | Error normalization link — GraphQL errors, network failures, timeouts and aborts into `ApiError`; network failure detected by error **type** + `navigator.onLine`, never by message text | ✅ |
| F3.5 | 401 handling **in the link, once**: single-flight refresh, replay the operation once, else `clearStore()` + session-expired signal | ✅ |
| F3.6 | Request id read off the `x-request-id` response header and attached to `ApiError` (P3 now exposes it cross-origin) | ✅ |
| F3.7 | Cache `typePolicies` — relay-style pagination for all 12 `*Connection` fields, with `keyArgs` so filters/sorts do not merge | ✅ |
| F3.8 | `ApolloRootProvider` in the app root; exactly one client instance | ✅ |
| F3.9 | Depth-limit guard: a build check that fails if any operation exceeds depth 12 | ✅ |
| F3.10 | MSW GraphQL handler helpers + fixtures for the shared test harness | ✅ |
| F3.11 | `session.store.ts` — the in-memory access token (pulled forward from F4.1; the socket link needs it) | ✅ |

### Exit criteria (DoD)

- [x] `pnpm --filter optitask-frontend run codegen` is **idempotent** — verified
      by regenerating and confirming a clean `git diff`.
- [x] Generated output is committed and type-checks.
- [x] Documents live **only** in `*.operations.ts` files — verified by grep.
- [x] All 7 server error codes plus `network`, `timeout`, `aborted`,
      `rate_limited` and `service_unavailable` map to a distinct
      `ApiError.kind`. The code test iterates `ERROR_CODES` from `@contracts`,
      so a code added to the backend fails the suite rather than silently
      degrading to `unknown`.
- [x] Every kind resolves to a real i18n string (asserted per kind).
- [x] `aborted` is mapped as its own kind and carries no distinct user-facing
      copy. *(That the UI never renders it is a Phase 5 concern; nothing
      renders errors yet.)*
- [x] A `UNAUTHENTICATED` response triggers exactly **one** refresh even when
      three requests fail concurrently (asserted with MSW).
- [x] A failed refresh clears the access token, empties the Apollo cache, and
      signals session expiry (asserted). The redirect itself lands in Phase 5.
- [x] Two different filter values on the same connection produce **separate**
      cache entries (asserted against `myNotifications(unreadOnly:)`).
- [x] Paging appends rather than replaces (asserted end-to-end through the cache).
- [x] The depth check fails a deliberately 14-level document naming the
      operation, then passes once removed — verified, not assumed.
- [x] No component imports `apollo.client.ts` directly — verified by grep.

---

# Phase 4 — Auth & Session — 32 → 40%

**Goal:** A complete, honest identity surface and a session that survives reload.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F4.1 | `session.store.ts` — module-scoped in-memory access token, subscribable; used **only** for WS `connectionParams` | ✅ *(landed in Phase 3 as F3.11)* |
| F4.2 | `auth.operations.ts` — register, login, logout, me, sessions, revokeSession, changePassword, requestPasswordReset, acceptInvitation | ✅ |
| F4.3 | `auth.schema.ts` — zod mirroring the backend exactly: email trim + lowercase; password 8–100 chars, ≥1 letter, ≥1 number | ✅ |
| F4.4 | `Login.page.tsx` + `Register.page.tsx` — split layout, inline validation, form-level server error | ✅ |
| F4.5 | `auth.context.tsx` — bootstrap: call `me`; if that fails, one refresh then retry; else unauthenticated | ✅ |
| F4.6 | `Sessions.page.tsx` — list active sessions (user agent, IP, created), revoke individually, mark the current one | ✅ |
| F4.7 | `ChangePasswordForm` | ✅ |
| F4.8 | `ForgotPassword.page.tsx` — honest copy: reset is not enabled; no email field at all | ✅ |
| F4.9 | Logout: mutation → clear token (closes the socket) → `clearStore()` | ✅ |
| F4.10 | `AcceptInvitation.page.tsx` → `acceptInvitation`, with a sign-in-first path | ✅ |
| F4.11 | `formatRelativeTime` — locale-aware relative timestamps for the sessions list | ✅ |

### Exit criteria (DoD)

- [x] Register → `me` with cookies alone → still authenticated. Verified against
      the **running backend** with a cookie jar: register set both HTTP-only
      cookies, `me` succeeded carrying only those cookies, and `refreshToken`
      worked with no argument.
- [x] `localStorage` and `sessionStorage` are **empty of any token** after login
      — asserted, not observed.
- [x] A credentialed cross-origin request succeeds (proves P1): the allowed
      origin is reflected with `Allow-Credentials: true`, a foreign origin gets
      no CORS headers at all.
- [x] An expired access token transparently refreshes and the operation replays
      (asserted in Phase 3's link tests, and again here through the bootstrap
      path where only the refresh cookie survives).
- [x] A failed refresh settles on `unauthenticated` with the cache cleared.
      *(The redirect itself belongs to Phase 5's router.)*
- [x] Client-side password validation matches the server exactly — a table test
      covers 7 chars, exactly 8, exactly 100, 101 chars, letters-only,
      digits-only and a valid value, plus email trim/lower-casing.
- [x] Wrong password and unknown email produce the **same** message, asserted
      not to contain "not found"/"no account"/"unknown user".
- [x] Signing out leaves no trace: token cleared, cache emptied, user cleared —
      all three asserted. Sign-out also completes locally when the server call
      fails.
- [x] Auth forms disable and show a spinner while pending, submit on `Enter`,
      and announce errors via `role="alert"` with per-field messages wired
      through `aria-describedby`/`aria-invalid`.
- [x] `ForgotPassword` has **no email field** and makes no claim that a message
      was sent — asserted against "check your inbox"/"we've sent" phrasing.
- [x] Coverage: success, wrong credentials, duplicate email, expired session,
      network failure, and `axe` clean on both forms.

---

# Phase 5 — App Shell, Routing & Guards — 40 → 47%

**Goal:** The frame every feature renders inside, and the navigation model.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F5.1 | React Router v7 data router; all paths as constants in `shared/routes/` — no string literals in `App.tsx` | ✅ |
| F5.2 | `AppLayout` — sidebar (nav), topbar (breadcrumbs, search, user menu), content region. Built from Avero's `SidebarNav`, `Drawer`, `DropdownMenu` and `Avatar`; `DashboardShell` was not used (see known-debt). Phase 6 added the Organisations destination to the sidebar; a project switcher lands with F7.2 and the notification bell with F11.1 — each needs queries those phases own | ✅ |
| F5.3 | `ProtectedRoute` + `GuestRoute` (auth) + `RequireCapability` (hint-only hide) | ✅ |
| F5.4 | `shared/lib/capabilities.ts` — derive capability hints from the user's role using the `@contracts` vocabulary; documented as a hint, never authority | ✅ |
| F5.5 | Route-level code splitting + Suspense skeletons per route | ✅ |
| F5.6 | Error boundary per route + `NotFound.page.tsx` + `Forbidden.page.tsx` | ✅ |
| F5.7 | Breadcrumbs derived from the route tree, via a `crumb` translation key in each route `handle` | ✅ |
| F5.8 | Responsive shell: sidebar collapses to a drawer below Tailwind's `lg` breakpoint (1024px, not the 900px first planned — one breakpoint shared with the auth layout) | ✅ |
| F5.9 | Command palette (⌘K / Ctrl+K): every sidebar destination plus sign-out. Entity search joins as each feature brings its queries | ✅ |
| F5.10 | Session expiry reaches the UI: a failed refresh settles the auth context on `unauthenticated`, so the guard redirects | ✅ |
| F5.11 | Auth screens navigate through the router instead of callbacks; `/account/sessions` and `/account/security` routed; signed-in `Home.page.tsx` | ✅ |

### Exit criteria (DoD)

- [x] `App.tsx` contains **zero** data fetching and zero business logic: it is
      lazy page imports, the route tree and the router instance.
- [x] Every route path is a constant; `grep` finds no hard-coded route string in
      a component.
- [x] Visiting a protected route unauthenticated redirects to login **and returns
      to the intended route** after login (asserted end to end through the real
      route tree). The return target is validated, not trusted: an absolute or
      protocol-relative URL falls back to home. A deliberate sign-out does **not**
      carry the page over, so the next person to sign in does not land on the
      previous user's screen.
- [x] A failed refresh mid-session redirects to login (asserted). Phase 3 and 4
      deferred this redirect to here.
- [x] A `FORBIDDEN` from a query renders `Forbidden.page.tsx` — when the page
      passes its error to `useEscalateRouteError`. That is a convention each page
      must follow, not something enforced; see known-debt.
- [x] An unknown path renders `NotFound.page.tsx` inside the shell. A signed-out
      visitor is sent to sign in first, which avoids revealing which paths exist.
- [x] A thrown render error is caught by the boundary, the error's own message is
      **not** shown, and retry re-renders the route (asserted).
- [x] Each route lazy-loads: the production build emits a separate chunk per
      page, and the shell (`AppLayout`, with the command palette) is its own
      27.7 kB-gzip chunk that a signed-out visitor never downloads. Verified in
      the build output, not the network panel.
- [~] Keyboard: the skip link is the first tab stop and targets `main`; the
      drawer, account menu and command palette are driven by keyboard in tests.
      A full keyboard walkthrough in a real browser has **not** been done.
- [~] The drawer traps focus, closes on `Esc` and returns focus to its trigger
      (asserted). That the sidebar actually gives way to it at 360px is
      **unverified**: the test DOM performs no layout.
- [x] `axe` → 0 violations on the shell, with the `region` rule **on**. Color
      contrast is not covered — axe cannot compute it without layout.

> **Not verified by me:** nothing in this phase has been seen in a browser.
> Run `pnpm run backend-dev` and `pnpm run frontend-dev`, sign in, and look at
> the shell at a phone width and a desktop width before Phase 6 builds on it.
> This is the first screen where the amber brand and the Avero setup are
> actually visible.

---

# Phase 6 — Organization & Members — 47 → 54%

**Goal:** The top of the ownership tree: orgs, membership and invitations.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F6.1 | `Organizations.page.tsx` — `myOrganizations` paginated, create-org flow | ✅ |
| F6.2 | `Organization.page.tsx` — the frame (header + tabs) around four routed tabs; settings tab with update and delete (with `ConfirmDialog`). The logo is a URL field: nothing can be uploaded | ✅ |
| F6.3 | Members table — `updateMemberRole`, `removeMember`; owner shown as immutable | ✅ |
| F6.4 | Invitations — `organizationInvitations` list, `inviteToOrganization`, `revokeInvitation`, status chips (`PENDING`/`ACCEPTED`/`REVOKED`/`EXPIRED`). The screen states that invitations are **not delivered**: the API sends no email and never returns the link (see known-debt) | ✅ |
| F6.5 | `Profile.page.tsx` — `updateProfile`, avatar (URL), seniority | ✅ |
| F6.6 | Skills + expertise editors — `addSkill`, `removeSkill`, `addExpertise` (tag + confidence), `removeExpertise` | ✅ |
| F6.7 | Org projects list via `Organization.projects(status)` — read-only; rows become links in Phase 7 | ✅ |
| F6.8 | `UserProfile.page.tsx` — the `user` query: another person's skills, expertise and teams, read-only, linked from the members table | ✅ |
| F6.9 | Breadcrumbs named from data (`crumbId` + `useBreadcrumbLabel`), so the trail reads "Organisations › Acme Inc. › Members" | ✅ |
| F6.10 | Shared pieces every later list and form will reuse: `LoadMore` + `useLoadMore`, `SelectField`, `useErrorToast`, `useEntityIdParam` | ✅ |

### Exit criteria (DoD)

- [x] Every profile and organisation mutation in Appendix A is reachable from the
      UI (12, plus `acceptInvitation` from Phase 4).
- [x] No members, no projects and no invitations each render their own empty
      state, and "no projects in this status" is a fourth, distinct from "no
      projects yet". (The no-members state exists but cannot occur: the owner
      is always a member.)
- [x] A role change updates the table from the mutation result — asserted by
      counting requests: the organisation is fetched exactly once.
- [x] Delete organisation, remove member and revoke invitation each require a
      `ConfirmDialog` that names the target; each test asserts nothing is sent
      before the confirmation.
- [x] A plain member sees no manage controls and no admin tabs. A refusal on a
      control that *was* shown (the hint said yes, the server said no) produces
      a toast and leaves the data as it was. Opening an admin tab by URL renders
      the Forbidden screen.
- [x] Expertise confidence is collected as a whole percentage (0–100), validated
      before any request, and sent as the 0–1 fraction the API stores.
- [x] Pagination past one page is asserted on the organisation list: the second
      page appends, the cursor is sent back untouched, and no request asks for
      more than 100. Members and projects page through the same `useLoadMore`
      hook but are not separately asserted.
- [x] Tests cover success, `BAD_USER_INPUT`, `FORBIDDEN`, `CONFLICT` and a
      network failure, and assert that the server's own error text never reaches
      the screen. 83 new tests; the suite is 244 tests in 15 files.

> **Not verified by me:** none of these screens has been seen in a browser, and
> nothing here has run against the real backend — every response in the tests
> is a mock shaped from the SDL.

---

# Phase 7 — Project & Team — 54 → 61%

**Goal:** Projects under orgs, teams under projects, including the attributes the
AI assignment engine consumes.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F7.1 | Project list + create; status filter. The list is the organisation's Projects tab (`OrganizationProjects.page.tsx`, built in F6.7), which gained the create dialog and links into each project — the API has no "my projects" query to build a separate page on | ✅ |
| F7.2 | `Project.page.tsx` — the frame (header + tabs) around routed tabs: Overview · Members · Teams · Settings today. Board, Backlog, Sprints, Epics, Analytics and AI are added **with** their phases, never as dead tabs | ✅ |
| F7.3 | Project status control — a state-machine-aware UI offering only legal transitions (`PLANNING → ACTIVE/ARCHIVED`, `ACTIVE → COMPLETED/ARCHIVED`, `COMPLETED → ACTIVE/ARCHIVED`, `ARCHIVED` terminal) | ✅ |
| F7.4 | Project members — add, update role (`ADMIN`/`MEMBER`/`VIEWER`), remove | ✅ |
| F7.5 | `configureWorkflow` — raw JSON editor, clearly labelled as unvalidated scaffolding | ✅ |
| F7.6 | Teams — create, update, delete, list per project | ✅ |
| F7.7 | Team members — add/update/remove with `role`, `responsibilities`, `availability`, `workload` | ✅ |
| F7.8 | Reusable `MemberPicker` (Avero `Combobox`, searchable by name or email) fed from a scoped membership — organisation members for a project, project members for a team — **never** the global `users` query | ✅ |

### Exit criteria (DoD)

- [x] The status control **never offers an illegal transition**: a table test
      covers all four states against all four targets, and the rendered buttons
      are asserted for each non-terminal state.
- [x] `ARCHIVED` presents no transition affordance at all — it says the project
      cannot be reopened.
- [x] A rejected transition surfaces a toast and leaves the cached status alone.
      Status changes are deliberately **not** optimistic, so there is nothing to
      roll back. The toast is specific ("not allowed from the current status")
      rather than the generic validation text, which points at a form.
- [x] The global user directory is not used by any picker — a standing test
      reads every `*.operations.ts` and fails if one selects `users(`, which is
      stricter than the grep first planned.
- [x] Empty states for: no projects, no teams, no project members, no team
      members; plus "no one left to add" on both pickers.
- [x] Availability and workload are columns on every team member row, visible to
      anyone who can read the team.
- [x] The workflow editor refuses anything that is not a JSON **object** (invalid
      JSON, arrays, strings, numbers, `null`) before submit, and says in a
      notice that the server stores it without checking its shape.
- [x] Tests cover success, `BAD_USER_INPUT`, `FORBIDDEN`, `CONFLICT` and a network
      failure in both modules. 105 new tests; the suite is 349 tests in 17 files.

> **Not verified by me:** none of these screens has been seen in a browser, and
> nothing has run against the real backend — every response in the tests is a
> mock shaped from the SDL.

---

# Phase 8 — Task: Board, List & Detail — 61 → 72%

**Goal:** The heart of the product. The largest phase — split into sub-branches.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F8.1 | `task.operations.ts` — fragments first; every task field/relation as reusable fragments, depth kept under 12 (deepest path is 6) | ✅ |
| F8.2 | `Board.page.tsx` — 7 status columns, each with its own count and its own next page, in a horizontal scroll container. A column of more than 30 cards is windowed with `@tanstack/react-virtual` and scrolls on its own; a shorter one renders whole | ✅ |
| F8.3 | Moving a card → `changeTaskStatus`. Three ways, one state machine (`useBoardMove`): drag with a mouse or a touch (`@dnd-kit/core`), the keyboard (pick up, arrow keys choose a column, drop, Escape cancels), or a tap on the column. Every step is announced through one live region | ✅ |
| F8.4 | Status state machine in the client, mirroring the backend table: only legal transitions are offered, on the board and on the detail page | ✅ |
| F8.5 | `TaskList.page.tsx` — table view with `TaskFilter` (status, priority, assignee, sprint, epic, label), `sortField`, `sortDirection`, cursor pagination | ✅ |
| F8.6 | `TaskCard` — priority, story points, assignee avatar, labels, due date (overdue marked), blocked flag | ✅ |
| F8.7 | `TaskDetail.page.tsx` — full record; title/description/priority/dueDate edited in place | ✅ |
| F8.8 | Assignment — `assignTask` including unassign (null), sourced from project members | ✅ |
| F8.9 | Story points — `setTaskStoryPoints`, including clearing to null | ✅ |
| F8.10 | Sprint move — `moveTaskToSprint` (and out of a sprint) | ✅ |
| F8.11 | Dependencies — `addTaskDependency` / `removeTaskDependency`; the server's cycle rejection gets its own message | ✅ |
| F8.12 | Time tracking — `logTaskTime` (additive seconds), entered as hours and minutes, displayed as a duration | ✅ |
| F8.13 | Watchers — `watchTask` / `unwatchTask` with a watch toggle | ✅ |
| F8.14 | Labels — `addTaskLabel` / `removeTaskLabel` | ✅ |
| F8.15 | Activity timeline — `Task.activities` paginated, one sentence per `ActivityType`, ids resolved to names | ✅ |
| F8.16 | `createTask` dialog (board and list) + `deleteTask` with confirmation | ✅ |
| F8.17 | Read queries for the project's sprints and epics, so a task's `sprintId` / `epicId` can be named and picked. Phase 9 builds its screens on the same fields | ✅ |
| F8.18 | `dateInputToApi` / `apiToDateInput` / `formatCalendarDate` — the Avero `DatePicker` reports `YYYY-MM-DD`; every date sent is a full RFC-3339 instant | ✅ |

### Exit criteria (DoD)

- [x] All 14 task mutations from Appendix A are reachable, and the `task` query.
      (The plan said 16; the SDL has 14.)
- [x] Moving a card has a **complete keyboard path** (grab, move, drop), tested:
      focus follows the card into its new column and every step is announced.
      A card can also be dragged with a mouse or a touch, tested by laying the
      columns out for the drag library to measure; nothing is mouse-only.
- [x] An illegal transition is never offered: only the legal columns become
      targets (asserted column by column), and a table test covers all 7 × 7
      pairs. A server rejection rolls the card back and says why (asserted for
      `BAD_USER_INPUT` and `FORBIDDEN`).
- [x] Optimistic updates for status, assignment and story points; each has a
      tested rollback.
- [x] Filtering by each of the 6 `TaskFilter` fields works; combinations are sent
      together and each is its own cached list (`keyArgs`).
- [x] Changing a filter keeps the previous rows on screen while the new ones
      load (asserted with a held request).
- [x] Three distinct empty states: no tasks in the project, none matching the
      filter, none in this column.
- [x] A cycle-creating dependency shows a specific message, not the generic
      validation text.
- [x] `sprintId`/`epicId` render as **names**, resolved from the project's sprint
      and epic lists; an id that is not listed is described, never printed.
- [x] `loggedSeconds` renders as a duration (`3h 20m`), never a raw number.
- [~] The board scrolls sideways inside its own container. That it is usable at
      360px is **unverified**: the test DOM performs no layout.
- [~] A board of 200+ tasks at 60fps — **not measured**: it needs a browser.
      A long column is windowed (asserted: 40 cards loaded, fewer rendered), so
      the DOM no longer grows with each "load more".
- [x] `axe` → 0 violations on board, list and detail (the component-level audit;
      contrast is not covered).
- [x] Tests: lifecycle, cycle rejection, illegal transition, unassign, filter
      combinations, `FORBIDDEN` on a viewer, network failure. 79 new tests; the
      suite is 428 tests in 18 files.

> **Not verified by me:** none of these screens has been seen in a browser, and
> nothing has run against the real backend — every response in the tests is a
> mock shaped from the SDL.

> Dragging in particular is unseen. The tests drive it with synthetic mouse
> events over stubbed column rectangles; how it feels — the 8px start
> threshold, the 250ms touch hold, auto-scroll at the board's edges — can only
> be judged in a browser.

---

# Phase 9 — Sprint & Epic — 72 → 79%

**Goal:** Planning surfaces and the metrics/burndown visualizations.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F9.1 | `Sprints.page.tsx` — list per project (paginated), create; update and delete live on the sprint's own page | ✅ |
| F9.2 | Sprint state control honoring the machine (`PLANNED → ACTIVE/CANCELLED`, `ACTIVE → COMPLETED/CANCELLED`, both terminal) | ✅ |
| F9.3 | `SprintDetail.page.tsx` — goal, dates, capacity, task list (paginated), add/remove tasks | ✅ |
| F9.4 | Metrics panel — total/completed/remaining points, task counts, completion rate, velocity, capacity, **over-capacity warning** | ✅ |
| F9.5 | Burndown chart (`@averoui/charts` `LineChart`) — ideal vs actual; explicit empty state when start/end dates are unset | ✅ |
| F9.6 | Workload distribution per assignee — a table with a comparison bar per row, not a chart: Avero ships line and area charts only (see known-debt) | ✅ |
| F9.7 | `Epics.page.tsx` + `EpicDetail.page.tsx` — CRUD, live progress bar, child tasks, `refreshEpicProgress` | ✅ |
| F9.8 | Milestones — `createMilestone`, `deleteMilestone`, listed on their epic; no update exists (backend gap — said in the interface) | ✅ |
| F9.9 | Sprints and Epics tabs on the project frame; routes, breadcrumbs named from data; `Sprint.tasks` paginated in the cache | ✅ |

### Exit criteria (DoD)

- [x] Sprint state control offers only legal transitions; terminal states offer
      none and say why. A table test covers all 4 × 4 pairs, and the rendered
      buttons are asserted for each state.
- [x] Over-capacity is unmistakable: a `danger` alert that says by how many
      points, and the capacity bar turns `danger`. It is said in words, never
      by color alone.
- [x] A sprint **without** start/end dates renders a specific "burndown needs
      dates" empty state — not an empty chart frame and not a spinner. A dated
      sprint with no points yet gets a different one.
- [x] The burndown's series are also a data table (asserted cell by cell). It is
      visible to assistive technology only — see known-debt.
- [x] Chart series colors come from Avero's chart tokens; none is written here.
- [x] Epic progress bar matches the computed `progress` value, and
      `refreshEpicProgress` is offered as "Save progress" beside a sentence
      explaining that the figure shown is always live and saving does not
      change it. The stored figure itself cannot be shown: the API does not
      expose it (see known-debt).
- [x] Empty states: no sprints, empty sprint, no workload, no epics, epic with
      no tasks, no milestones.
- [x] Milestone UI presents no edit affordance, and says a milestone cannot be
      edited (only to someone who can create or delete one).
- [x] Tests: figures against fixtures, empty sprint, over-capacity, illegal
      transition, `BAD_USER_INPUT`, `FORBIDDEN`, network failure, pagination,
      `axe` on all four screens. 84 new tests; the suite is 512 tests in 20
      files.

> **Not verified by me:** none of these screens has been seen in a browser, and
> nothing has run against the real backend. The burndown in particular has
> never been drawn: the test DOM has no size, so Recharts renders nothing there
> and only the chart's data table is asserted.

---

# Phase 10 — Collaboration: Comments & Attachments — 79 → 85%

**Goal:** The discussion surface on a task.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F10.1 | Comment thread — `Task.comments` paginated, nested replies via `parentCommentId` | ⬜ |
| F10.2 | Composer — `createComment`, submit on ⌘/Ctrl+Enter | ⬜ |
| F10.3 | Mention picker — resolves **project members** to `mentionedUserIds` (the API takes explicit IDs; it does not parse `@handle`) | ⬜ |
| F10.4 | Edit (`editComment`, shows an `edited` marker), `resolveComment` toggle, `deleteComment` with confirm | ⬜ |
| F10.5 | Attachments — `addTaskAttachment`, `addCommentAttachment`, `removeAttachment` as **metadata records** | ⬜ |
| F10.6 | Attachment UI states the storage limitation plainly; no fake upload progress, no dead download button | ⬜ |

### Exit criteria (DoD)

- [ ] Mentions are sent as validated `mentionedUserIds`; the composer never
      guesses a user from free text.
- [ ] The mention picker is keyboard-driven and sourced from project membership.
- [ ] An edited comment shows the `edited` marker; a resolved thread is visually distinct.
- [ ] Author-only vs admin permissions are reflected in the UI, and a `FORBIDDEN`
      on edit/delete is handled gracefully.
- [ ] Comment bodies are rendered as **plain text** (or sanitized markdown behind a
      `// BOUNDARY:` note) — no unsanitized HTML path exists.
- [ ] The attachment UI never implies a file was stored or can be downloaded.
      The known-debt limitation is stated in the interface itself.
- [ ] Empty states: no comments yet, no attachments.
- [ ] Optimistic comment insert with a tested rollback.
- [ ] Tests: post, edit, resolve, delete, mention resolution, `FORBIDDEN` on
      another user's comment, network failure.

---

# Phase 11 — Notifications & Realtime — 85 → 90%

**Goal:** The live layer. All 5 subscriptions wired, with an honest connection state.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F11.1 | Notification bell — `unreadNotificationCount`, popover feed | ⬜ |
| F11.2 | `Notifications.page.tsx` — paginated, `unreadOnly` filter, per-type presentation for all 6 `NotificationType`s | ⬜ |
| F11.3 | `markNotificationRead`, `markAllNotificationsRead` (returns a count → toast) | ⬜ |
| F11.4 | `realtime.client.ts` — `graphql-ws` link authenticated via `connectionParams` from the in-memory token; reconnect with backoff; re-auth after refresh | ⬜ |
| F11.5 | `notificationReceived` → increments the badge and prepends to the feed | ⬜ |
| F11.6 | `taskUpdated(projectId)` → updates board/list/detail cache in place | ⬜ |
| F11.7 | `commentAdded(taskId)` → appends to the open thread | ⬜ |
| F11.8 | `sprintUpdated(projectId)` → refreshes sprint state and metrics | ⬜ |
| F11.9 | `aiRecommendationUpdated(projectId)` → updates the AI queue | ⬜ |
| F11.10 | Connection status indicator (live / reconnecting / offline) | ⬜ |

### Exit criteria (DoD)

- [ ] **Write source of truth is explicit and singular**: mutations own writes;
      subscriptions only reconcile the cache. Documented per subscription. No
      state has two write paths.
- [ ] The socket authenticates via `connectionParams`, and the token comes from
      the in-memory store — never from storage.
- [ ] After a token refresh the socket re-authenticates without dropping subscriptions.
- [ ] On logout the socket closes immediately and does not reconnect.
- [ ] Reconnect uses capped exponential backoff and does not hammer the server —
      asserted with a fake-timer test.
- [ ] An event for an entity not currently cached does **not** create a partial
      cache entry.
- [ ] A duplicate event (mutation result and subscription event for the same
      change) produces exactly one visual update, not a flicker.
- [ ] The connection indicator tells the truth in all three states.
- [ ] The app is fully usable with the socket **down** — realtime is an
      enhancement, never a dependency. Verified by blocking the WS.
- [ ] Two browser windows: a change in one appears in the other without a reload.
- [ ] Empty state for an empty notification feed; distinct state for "no unread".

> **Note:** the backend pubsub is in-process (known-debt). Events are delivered
> only by the instance that published them, so cross-instance realtime is a
> backend concern, not a client bug.

---

# Phase 12 — AI Recommendations & Approval — 90 → 95%

**Goal:** The human-in-the-loop surface. This is OptiTask's differentiator and
must make the "AI suggests, a human decides" contract visible at every step.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F12.1 | `AiRecommendations.page.tsx` — `Project.aiRecommendations`, filtered by `type` and `approvalStatus` | ⬜ |
| F12.2 | Request actions on a task — `requestStoryPointEstimate`, `requestAssignmentRecommendation` | ⬜ |
| F12.3 | Request actions on a sprint — `requestSprintHealthAnalysis`, `requestProgressTracking` | ⬜ |
| F12.4 | `RecommendationCard` — text, type, **confidence score**, provider, timestamp, requester, both status fields | ⬜ |
| F12.5 | Decision controls — `approveRecommendation`, `rejectRecommendation`, `overrideRecommendation` (storyPoints / assigneeId) | ⬜ |
| F12.6 | `AssignmentContext` panel — candidate table: skills, expertise, workload, availability, active and completed task counts | ⬜ |
| F12.7 | Approval preview — state exactly what approving will change before it is applied | ⬜ |
| F12.8 | `SERVICE_UNAVAILABLE` handling — provider failure is explained as a provider problem, with retry; nothing was persisted | ⬜ |
| F12.9 | `CONFLICT` handling — re-approving an already-resolved recommendation | ⬜ |

### Exit criteria (DoD)

- [ ] Confidence score is **always** shown alongside any suggestion — a suggestion
      can never be presented as fact.
- [ ] The provider name and timestamp are visible on every recommendation.
- [ ] Approving shows a preview of the concrete change (e.g. "sets story points to
      5", "assigns to Dana") **before** it is applied.
- [ ] `approvalStatus` (`PENDING`/`APPROVED`/`REJECTED`/`OVERRIDDEN`) and
      `resolutionStatus` (`OPEN`/`RESOLVED`/`DISMISSED`) are both surfaced and
      visually distinguishable — they are different axes and must not be conflated.
- [ ] A user with `ai:request` but not `ai:approve` sees request actions and
      **no** decision controls; a forced attempt still fails gracefully.
- [ ] Sprint health and progress recommendations are presented as informational —
      the UI does not imply approving them changes data.
- [ ] `SERVICE_UNAVAILABLE` produces a specific, non-alarming message with retry
      and makes clear nothing was saved.
- [ ] Re-approving a resolved recommendation surfaces the `CONFLICT` clearly and
      refreshes to the current state.
- [ ] The AI request button shows a pending state for the full provider timeout
      (default 8s) without appearing frozen.
- [ ] Empty states: no recommendations, none matching the filter, no candidates in
      the assignment context.
- [ ] Tests: request → persist → approve, reject, override, `FORBIDDEN` on approve,
      `SERVICE_UNAVAILABLE`, `CONFLICT`.

---

# Phase 13 — Analytics — 95 → 98%

**Goal:** The reporting surface.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F13.1 | `ProjectAnalytics.page.tsx` — KPI row: total/completed tasks, total/completed story points, completion rate, team velocity | ⬜ |
| F13.2 | Task distribution by status and by priority | ⬜ |
| F13.3 | Story point trends per sprint (committed vs completed) | ⬜ |
| F13.4 | Individual workloads table — active tasks, active points, completed | ⬜ |
| F13.5 | User analytics — completed tasks, historical points, avg completion time, velocity, active assignments | ⬜ |
| F13.6 | `recomputeUserStatistics` action, explaining live vs persisted figures | ⬜ |

### Exit criteria (DoD)

- [ ] A brand-new project renders **zeroed/empty shapes**, never `NaN`, `—` with no
      explanation, or a broken chart.
- [ ] Every chart has an accessible data-table equivalent and a text summary.
- [ ] Chart series colors come from the semantic token families.
- [ ] `completionRate` and `teamVelocity` render with defined precision and units.
- [ ] `avgCompletionSeconds` renders as a human duration; a `null` renders as an
      explained absence, not a blank cell.
- [ ] `userAnalytics` is visible for self; another user's is attempted only where
      permitted and `FORBIDDEN` is handled.
- [ ] The UI explains that `user.statistics` is a cache and `userAnalytics` is live
      (per known-debt) so a mismatch is not read as a bug.
- [ ] Charts have their own `overflow-x: auto` container and never widen the page.
- [ ] Tests: zeroed project, populated fixtures reconcile with rendered figures,
      `FORBIDDEN`, network failure.

---

# Phase 14 — Hardening, A11y, Perf & Release — 98 → 100%

**Goal:** Production readiness. Nothing new is built here.

### Tracker

| ID | Task | Status |
|---|---|:--:|
| F14.1 | Full `axe` sweep across every route | ⬜ |
| F14.2 | Keyboard-only walkthrough of every primary flow | ⬜ |
| F14.3 | Screen-reader pass on auth, board, task detail and the AI approval flow | ⬜ |
| F14.4 | Bundle analysis; route chunks; font and icon loading strategy | ⬜ |
| F14.5 | Lighthouse on the production build | ⬜ |
| F14.6 | Coverage thresholds enforced in `vitest.config.ts` and in CI | ⬜ |
| F14.7 | E2E suite in `shared/tests/` — register → org → project → sprint → task → comment → AI approve → analytics | ⬜ |
| F14.8 | Security review against `apps/backend/docs/SECURITY.md` (client-relevant sections) | ⬜ |
| F14.9 | `apps/frontend/docs/known-debt.md` reconciled; `apps/frontend/README.md` written | ⬜ |
| F14.10 | CI: typecheck → lint → codegen-drift → test → build | ⬜ |
| F14.11 | Deployment doc: static build output, env vars, SPA fallback routing, CORS origin registration | ⬜ |

### Exit criteria (DoD)

- [ ] `axe` → **0 violations** on every route.
- [ ] Every primary flow completable with keyboard only, start to finish.
- [ ] Lighthouse on the production build: **Performance ≥ 90, Accessibility 100,
      Best Practices ≥ 95**.
- [ ] Initial JS payload budget agreed and met; the number is recorded here.
- [ ] Coverage thresholds met and enforced in CI (fails the build below them).
- [ ] The E2E suite passes against a **real running backend**, not mocks.
- [ ] No `console.log`, `debugger`, `.only()`, `.skip()`, or commented-out code.
- [ ] `grep` confirms: no token in storage, no secret in the bundle, no
      `dangerouslySetInnerHTML` without a sanitizer.
- [ ] CSP defined and documented for the deployment host.
- [ ] Production build smoke-tested as a **deployed artifact**, not via `dev`.
- [ ] SPA deep-link refresh works (server rewrites unknown paths to `index.html`).
- [ ] Every row in Appendix A is ✅ or has a written justification for ➖.
- [ ] Every phase above shows ✅ and this table reads 100%.

---

# Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **CORS blocks all credentialed requests** (P1) | Total blocker for Phase 4 | Fix in the backend before Phase 4; verify in a real browser, not a test client |
| R2 | Cross-site production deployment breaks `SameSite=Lax` cookies | Auth fails in prod only, after passing in dev | Decide the deployment topology **before** Phase 14. Same registrable domain keeps Lax working; otherwise `SameSite=None; Secure` + a CSRF token is required backend work |
| R3 | No `fieldErrors` from the server | Form UX degrades to form-level errors | Mirror backend zod rules client-side; treat a server `BAD_USER_INPUT` as the safety net, not the primary channel |
| R4 | Query depth cap of 12 | Runtime validation errors on rich screens | Fragment discipline from Phase 3; CI depth check (F3.9) |
| R5 | Attachments cannot store or serve bytes | A core-looking feature is hollow | The UI states the limitation. Do **not** build an upload flow that pretends to work |
| R6 | In-process pubsub | Realtime silently degrades on a scaled backend | Client treats realtime as an enhancement; app fully usable without it (F11 exit criterion) |
| R7 | `@contracts` is not a valid Node specifier | Imports type-check but fail at runtime | Both mappings added in F0.2/F0.3 and verified in all four contexts (F0 exit criteria) |
| R8 | Apollo Server v4 is EOL (2026-01-26) | Security exposure on the server | Backend concern; the client's Apollo version is independent. Track the v5 upgrade |
| R9 | Board performance with large projects | Jank on the primary screen | Virtualize from the start (F8.2); profile at 200+ tasks (F8 exit criterion) |
| R10 | Design-system drift once features start | The look decays feature by feature | Primitives only from Avero; feature styling only through theme tokens (Global DoD). The old "no raw values" CSS test went with the CSS Modules — a lint rule against arbitrary color values is the replacement to add |
| R11 | Avero's filled primary button is white-on-amber (≈ 2:1) | Every primary action fails WCAG contrast | Upstream fix in Avero (`--color-primary-foreground`); tracked in Amendment A1. Blocks the Phase 14 accessibility sign-off |
| R12 | Avero is a young, single-maintainer library | A gap or bug blocks a feature | It is maintained in-house, so gaps are fixed upstream rather than worked around locally; record each one in known-debt |

---

# Appendix A — API coverage matrix

Full parity (D6) means every row reaches ✅ or carries a written justification for
➖. Update alongside the phase trackers.

### Queries (22)

| Operation | Phase | Status |
|---|---|:--:|
| `health` | 14 | ⬜ |
| `me` | 4 | ✅ |
| `sessions` | 4 | ✅ |
| `user` | 6 | ✅ |
| `users` | ➖ | ➖ unscoped (known-debt) — deliberately unused; pickers use scoped membership |
| `organization` | 6 | ✅ |
| `myOrganizations` | 6 | ✅ |
| `organizationInvitations` | 6 | ✅ |
| `project` | 7 | ✅ |
| `team` | 7 | ✅ |
| `task` | 8 | ✅ |
| `sprint` | 9 | ✅ |
| `epic` | 9 | ✅ |
| `comment` | 10 | ⬜ |
| `myNotifications` | 11 | ⬜ |
| `unreadNotificationCount` | 11 | ⬜ |
| `aiRecommendation` | 12 | ⬜ |
| `assignmentContext` | 12 | ⬜ |
| `projectAnalytics` | 13 | ⬜ |
| `userAnalytics` | 13 | ⬜ |

### Mutations (75)

| Group | Operations | Phase | Status |
|---|---|---|:--:|
| Auth | `register` `login` `refreshToken` `logout` `changePassword` `requestPasswordReset` `revokeSession` | 4 | ✅ — `requestPasswordReset` is wired but deliberately has no screen (backend stub, see known-debt) |
| Profile | `updateProfile` `addSkill` `removeSkill` `addExpertise` `removeExpertise` | 6 | ✅ |
| Organization | `createOrganization` `updateOrganization` `deleteOrganization` `inviteToOrganization` `acceptInvitation` `revokeInvitation` `updateMemberRole` `removeMember` | 6 | ✅ — `updateOrganization.settings` (free-form JSON) is not surfaced; nothing reads it yet |
| Project | `createProject` `updateProject` `changeProjectStatus` `deleteProject` `configureWorkflow` `addProjectMember` `updateProjectMemberRole` `removeProjectMember` | 7 | ✅ |
| Team | `createTeam` `updateTeam` `deleteTeam` `addTeamMember` `updateTeamMember` `removeTeamMember` | 7 | ✅ |
| Task | `createTask` `updateTask` `changeTaskStatus` `assignTask` `setTaskStoryPoints` `moveTaskToSprint` `deleteTask` `logTaskTime` `addTaskDependency` `removeTaskDependency` `watchTask` `unwatchTask` `addTaskLabel` `removeTaskLabel` | 8 | ✅ |
| Sprint | `createSprint` `updateSprint` `changeSprintState` `deleteSprint` `addTaskToSprint` `removeTaskFromSprint` | 9 | ✅ |
| Epic | `createEpic` `updateEpic` `deleteEpic` `refreshEpicProgress` `createMilestone` `deleteMilestone` | 9 | ✅ — a milestone is always created on an epic: one without an epic cannot be listed by any query |
| Comment | `createComment` `editComment` `resolveComment` `deleteComment` `addTaskAttachment` `addCommentAttachment` `removeAttachment` | 10 | ⬜ |
| Notification | `markNotificationRead` `markAllNotificationsRead` | 11 | ⬜ |
| AI | `requestStoryPointEstimate` `requestAssignmentRecommendation` `requestSprintHealthAnalysis` `requestProgressTracking` `approveRecommendation` `rejectRecommendation` `overrideRecommendation` | 12 | ⬜ |
| Analytics | `recomputeUserStatistics` | 13 | ⬜ |

### Subscriptions (5)

| Operation | Phase | Status |
|---|---|:--:|
| `taskUpdated` | 11 | ⬜ |
| `commentAdded` | 11 | ⬜ |
| `sprintUpdated` | 11 | ⬜ |
| `notificationReceived` | 11 | ⬜ |
| `aiRecommendationUpdated` | 11 | ⬜ |

---

# Appendix B — Documentation drift found while planning

Backend doc fixes worth folding into a `docs` commit. None block the frontend.

- `api-reference.md` names the auth cookie `access_token`; the code uses
  `optitask_access` / `optitask_refresh` (`src/shared/auth/cookies.ts`).
- `api-reference.md` omits `revokeSession` and the `organizationInvitations` query.
- `api-reference.md` shows `revokeInvitation(id)`; the SDL is `revokeInvitation(invitationId)`.
- `README.md` links `docs/security.md` and `docs/security-checklist.md` — neither
  exists. Only `docs/SECURITY.md` (a generic secure-coding guide) is present, yet
  ROADMAP Phase 12 claims the checklist was signed off.
- `docs/ready.md` is stale at 85% / Phase 9; the roadmap and the code are at 100%.
- `README.md` §1 has a typo: `ppnpm run backend-dev`.
