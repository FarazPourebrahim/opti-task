# Frontend Handoff

State of `apps/frontend` as of **2026-10-06**, written so a new session can pick
up without the previous conversation. Read this, then `CLIENT_PLAN.md` (the
phase tracker and Definition of Done) and `apps/frontend/docs/known-debt.md`
(every shortcut, with its right fix).

---

## Start here

1. `git status` and `git branch --show-current`. The work tree should be clean
   on `frontend/F14`, which is pushed and **not merged**.
2. `pnpm --filter optitask-frontend run verify` should exit 0 with 667 tests
   in 26 files. If it does not, something changed since this was written.
3. `pnpm --filter optitask-frontend run e2e` should pass 23 tests in about
   nine minutes. It needs PostgreSQL and writes test accounts to the backend's
   database — see "The end-to-end suite" below.
4. Ask the owner whether to merge `frontend/F14` into `frontend/main`. Do not
   merge without that.
5. Nothing is left to build. What remains of Phase 14 is the owner's: see
   "What is left" below.

---

## Where things stand

**Progress: 99%** — Phases 0–13 and Amendment A1 are complete. Phase 14
(hardening and release) is done except for what needs the owner.

| Phase | What exists |
|---|---|
| 0, 3 | Tooling, env validation, Apollo client, error normalization, codegen |
| A1 | Component library is **Avero** (`@averoui/react`) on **Tailwind v4**; light theme only; amber brand |
| 4 | Auth: login, register, forgot password, sessions, change password, accept invitation |
| 5 | Router, guards, app shell, breadcrumbs, command palette, error screens |
| 6 | Organisations (list, members, invitations, settings), own profile, other users' profiles |
| 7 | Projects (overview, status, members, workflow, settings), teams and team members |
| 8 | Tasks: board with drag, keyboard and tap moves and windowed columns, filtered list, detail page with every task mutation |
| 9 | Sprints (list, detail, lifecycle, figures, burndown, workload, add/remove tasks) and epics (list, detail, progress, milestones) |
| 10 | Comments on a task (threads, one level of replies, mentions, edit, resolve, delete, link to a comment) and attachment records on tasks and comments |
| 11 | Notification bell and page; the socket (status, backoff, re-auth, catch-up); all five subscriptions reconciling the cache |
| 12 | AI: the project's recommendation queue, request panels on a task and a sprint, approve (with a preview), reject, override, the assignment candidates table |
| 13 | Analytics: the project's Analytics tab (headline figures, tasks by status and priority, story points per sprint, individual workloads) and a person's figures on their profile, with the save of one's own |
| 14 | A browser suite against the real backend (23 tests), coverage floors, a build check, a verified Content-Security-Policy, the README, the deployment guide, a CI template; and the layout faults the first look in a browser found, fixed |

Verified at handoff: `pnpm --filter optitask-frontend run verify` exits 0
(typecheck, lint, query-depth check, **667 tests in 26 files**) and
`run build` succeeds.

**Seen in a browser, against the real backend** (2026-10-06, Phase 14):
every screen at 1280px and 360px, a real drag, the real socket, two people
on one board, two tabs loading at once, the production build under its
security headers. What that showed is in `CLIENT_PLAN.md`, Phase 14.

**Still never verified:** a touch drag on a real phone, scrolling a board of
200 cards, anything a screen reader says, and any real deployment. Most
mutations are not performed by the browser suite and have only met mocks.

---

## Git state

| Branch | State |
|---|---|
| `frontend/F14` | Phase 14. Pushed. **Not merged** — waiting for the owner's go-ahead. |
| `frontend/main` | Phases 0–13 + A1. Pushed, in sync with origin. |
| `main` | **Local is 2 commits ahead of `origin/main`** (the merge of the partner's amber `colors.md`). `git push origin main` is **rejected by a repository rule** — do not work around it; the owner must push or open a PR. |
| `ai/main` | The AI team's branch. Leave it alone. |
| `frontend/F5`, `F6`, `F7`, `F8`, `F9`, `F10`, `F11`, `F12`, `F13`, `averoui-migration` | Merged; kept locally. |

Workflow the owner has confirmed, phase by phase:

1. Cut `frontend/F<n>` from `frontend/main`.
2. Commit in chunks: `type(Scope): Title-Style Description`. **No AI
   attribution** in commits (no `Co-Authored-By`, no "Generated with").
3. Push the phase branch.
4. Report, and **wait for the owner's go-ahead** before merging into
   `frontend/main` (merge with `--no-ff`, message
   `merge(Frontend): Complete Phase N — …`) and pushing it.

The owner approved pushing frontend branches. Pushing `main` was never
possible. Other people work in this repo: a partner on `frontend/main`, AI
developers on `ai/*`.

---

## Decisions made in conversation

These came from the owner and are binding. All are recorded in `CLIENT_PLAN.md`
(Amendment A1, D2/D5/D9/D10) except where noted.

- **Avero replaces the in-house components — full replacement**, not a wrapper.
  Tailwind v4 is the styling system; CSS Modules are gone.
- **Light theme only.** No theme switch.
- **Brand is amber** (`apps/frontend/colors.md`, set in
  `src/shared/styles/global.css`).
- **Contrast on amber is to be fixed in Avero itself**, not worked around here
  (a `--color-primary-foreground` token). Avero is the owner's own library
  (github.com/FarazPourebrahim/avero). Until then primary buttons and the
  current sidebar item are white-on-amber at about 2:1.
- **Warning color**: the owner asked for "near yellow but not confused with
  amber, or some sort of blue, whichever is better". Orange was chosen because
  blue is Avero's info tone. One line in `global.css` if they want otherwise.

- **The browser pass was skipped on 2026-10-05, by choice, and done on
  2026-10-06** at the start of Phase 14 — with a headless Chrome driven by
  Playwright, because the owner declined the Chrome extension that day.
- **A link to a comment** (`?comment=<id>`, "Copy link") was added in Phase 10
  without being asked for, so the `comment` query is reachable (D6). The owner
  was told and did not object. It is recorded as F10.7.

Still undecided: see "What is left" below.

---

## Open items that need someone else

| Item | Owner | Detail |
|---|---|---|
| White text on amber | Avero | Filled primary variants hard-code `text-white` |
| Warning alerts/toasts/badges are amber | Avero | They use Tailwind's `amber-*` directly; only the warning *button* reads `--color-warning` |
| Invitations cannot be accepted | Backend | No email is sent and `OrganizationInvitation` does not expose the token, so nobody ever sees the link. The UI says so in a warning |
| No `viewerRole` on Organization/Project/Team | Backend | Roles are inferred from paginated member lists |
| No member search | Backend | Pickers only see the first 20 loaded members |
| No "my projects" query | Backend | Projects are reached through their organisation; no sidebar switcher |
| `workload` has no unit | Backend | A bare 0–1000 integer |
| Milestones only exist on an epic, and cannot be edited | Backend | No `Project.milestones`, no `updateMilestone` |
| A task cannot change epic after creation | Backend | `UpdateTaskInput` has no `epicId` |
| Stored epic progress is unreadable | Backend | `refreshEpicProgress` writes a column no field exposes |
| Chart data table is screen-reader only; no bar chart; charts pin tokens ^1 | Avero charts | See known-debt, Phase 9 |
| Attachments store no file | Backend | Records only; the UI says so and has no upload or download |
| Attachment size capped at 2^31 − 1 bytes | Backend | `sizeBytes` is a GraphQL `Int`; the server's 5 GB rule is unreachable |
| A comment's mentions cannot be edited; replies are an unpaginated list, one level per query | Backend | See known-debt, Phase 10 |
| Most changes are not announced over the socket (task created or deleted, labels, comments edited or deleted, epics…) | Backend | Only five kinds of change publish an event; see known-debt, Phase 11 |
| A recommendation cannot be listed by task or sprint, and does not name its task, sprint or suggested person | Backend | So a task shows only this visit's suggestions; see known-debt, Phase 12 |
| A decision changes a task without returning it or announcing it | Backend | The client re-reads the task's two fields after each applied decision |
| Nothing says whether the viewer may see another person's analytics | Backend | So those figures are asked for on demand, and a refusal is explained; see known-debt, Phase 13 |
| A team lead is refused project analytics, against `rbac.md`; saving statistics works for the owner alone | Backend | The UI follows the server in both; see known-debt, Phase 13 |
| A socket cannot authenticate from the session cookies | Backend | So a reload costs a token refresh; two tabs loading at once may trip reuse detection — untested |
| `main` push rejected | Repo owner | See Git state |

---

## How the code is organised

```
src/
├── App.tsx                 route tree only: lazy pages, guards, layout nesting
├── modules/<feature>/
│   ├── <Feature>.page.tsx
│   ├── graphql/<feature>.operations.ts   ← every GraphQL document lives here
│   ├── hooks/        components call hooks, never useQuery/useMutation directly
│   ├── schemas/      zod, mirroring the backend's validation file
│   ├── components/
│   ├── utils/
│   └── <feature>.test.tsx
└── shared/
    ├── components/   ONLY what Avero lacks (see index.ts)
    ├── hooks/        useLoadMore, useErrorToast, useEscalateRouteError,
    │                 useEntityIdParam, useRealtime (subscribe, listen, status, catch-up)
    ├── context/      AppProviders, apollo, breadcrumb
    ├── constants/    realtime.constants (backoff, offline threshold)
    ├── lib/          apiError, capabilities
    ├── routes/       route.constants.ts (ROUTES, ROUTE_SEARCH, path helpers, CRUMB_IDS)
    ├── services/     apollo.client, auth.gateway, session.store,
    │                 realtime.client (the socket + its status), realtime.events (in-app bus)
    ├── utils/        date, form, id, cache (connection/list edits, isCached, writeEntity)
    ├── i18n/locales/en.json
    └── tests/        renderWithProviders, session, graphql, setup, server,
                      realtime (fake socket server), realtime.test (cross-feature)
```

Modules: `auth`, `user`, `organization`, `project`, `team`, `task`, `sprint`,
`epic`, `comment` (comments **and** attachments), `notification`, `ai`,
`analytics`, `shell`, `home`.

Where a feature shows up outside its own module:

| On this screen | From this module |
|---|---|
| Top bar | `notification` (bell), `shell` (connection status) |
| Project frame (`Project.page.tsx`) | the three project subscriptions: `task`, `sprint`, `ai` |
| Task page | `comment` (Comments, Attachments cards), `ai` (AI suggestions card) |
| Sprint page | `ai` (AI insights card) |
| Own profile, another person's profile | `analytics` (Analytics card) |

### Patterns to follow (each exists; copy it)

- **A feature frame with tabs**: `modules/organization/Organization.page.tsx`
  and `modules/project/Project.page.tsx`. The frame makes the one query,
  resolves the viewer's roles, and hands both to its tabs through
  `<Outlet context>` + a typed `use<Feature>Context()` hook. A new project
  screen is a new tab in `Project.page.tsx` and a nested route in `App.tsx`
  (the Analytics tab is the latest example, and one shown only to some roles). The
  tab list is asserted in `project.test.tsx`, which must be updated with it.
- **Capability hints**: `can(roles, 'task:update')` from
  `shared/lib/capabilities.ts`, or `<RequireCapability>`. Hints only hide;
  every mutation still handles `FORBIDDEN` (toast via `useErrorToast`, or a
  form-level `FormError`).
- **Roles are scoped**: `resolveOrganizationRoles` → `resolveProjectRoles` →
  `resolveTeamRoles`, each adding to the one above.
- **Whole-page failures**: `useEscalateRouteError(error)` in the page turns
  `FORBIDDEN` / `NOT_FOUND` into the Forbidden / Not Found screen. Everything
  else is shown inline with `ErrorState` and a retry.
- **Route ids**: `useEntityIdParam(ROUTE_PARAMS.x)` — a malformed id is Not
  Found without asking the server.
- **Forms**: zod schema with i18n keys as messages → `toFieldErrors` →
  `FormField` / `SelectField` / `MemberPicker`; server rejection → `FormError`.
  The API returns only a `code`, never field errors.
- **Pagination**: `useLoadMore(pageInfo, fetchAfter)` + `<LoadMore>`. Cursors
  are opaque. Page size is `DEFAULT_PAGE_SIZE` from `@contracts`.
- **Cache after a mutation**: prefer a mutation that returns the entity by id
  (auto-updates). For boolean deletes use `removeFromConnection`
  (`shared/utils/cache.utils.ts`). For "delete this page's entity": navigate
  away **first**, then evict (see `forgetOrganization` / `forgetProject`) —
  evicting while mounted flashes Not Found.
- **Destructive actions**: Avero `ConfirmDialog`, title names the target,
  `onConfirm` returns a promise that never rejects.
- **Breadcrumbs**: `handle: { crumb: 'nav.x', crumbId: CRUMB_IDS.y }` on the
  route, `useBreadcrumbLabel(CRUMB_IDS.y, entity?.name)` in the page.
- **Strings**: all through `en.json`; keys are compile-checked. Enum labels
  live under `enums.*` and are read as `` t(`enums.projectState.${status}`) ``.
- **Dynamic keys** from data: `t(error.messageKey as never)` is the existing
  convention.

### Avero notes (v2.2.1)

- Import from `@averoui/react`. Read a component's API in
  `node_modules/@averoui/react/dist/components/<name>/*.d.ts`.
- `Button`: `loading`, `block`, `asChild`; variants `primary | outline | ghost |
  danger | warning | soft | secondary | inverse`. `secondary` is an orange CTA,
  not a neutral button — use `outline`.
- `Field` is compound; use our `FormField` / `SelectField` instead.
- `Card` + `CardHeader` + `CardTitle as="h2"`; `Alert tone=…`; `EmptyState
  variant="circle" icon={…}`; `Badge tone=…`; `Table*`; `Dialog*`; `Drawer*`;
  `DropdownMenu*`; `PillTabs`/`PillTab asChild current`; `Combobox`;
  `Progress`; `Skeleton`/`SkeletonText`; `Spinner`; `useToast()`.
- `AveroProvider locale="en-US"` is set in `AppProviders`; without it Avero is
  Persian, right-to-left.
- Missing from Avero: classic tabs, keyboard-key, a "load more", an error
  state, an app shell. `DashboardShell` was evaluated and not used.
- Avero has neither drag-and-drop nor virtualization: the board uses
  `@dnd-kit/core` and `@tanstack/react-virtual`.
- `DatePicker` reports `YYYY-MM-DD` and parses typed `yyyy/mm/dd`. Convert
  with `dateInputToApi` / `apiToDateInput`.
- A `Select` cannot hold an empty value: "nothing chosen" needs a named
  sentinel option (see `TaskFilters`).
- Charts: `@averoui/charts` (with `recharts`) is installed. It has `LineChart`,
  `AreaChart`, `ChartCard` and `ChartDataTable` — no bar or pie chart. A chart
  already renders its own screen-reader data table; do not add a second.
  `ChartCard`'s `empty` / `emptyState` props are where an empty state goes.
  `global.css` has an `@source` line for the package; without it `ChartCard`
  renders unstyled. Recharts draws nothing in the test DOM (no size), so tests
  assert the data table. A test file that opens a chart page should preload it
  in `beforeAll` (see `sprint.test.tsx`), or the first import can time out.

---

## Traps on this machine

- **CRLF.** The checkout uses `core.autocrlf=true`. Tools write LF, git
  normalises on commit, and `git status` shows files as modified that have no
  real diff. Harmless — but:
  - `pnpm run codegen:check` **always fails here**, even right after
    regenerating. Instead run `codegen` and read `git diff --stat` on
    `src/shared/graphql/generated`.
  - Scripted edits must normalise `\r\n` before matching.
- **Do not run prettier over the whole `src/`.** Older files are not
  prettier-clean and it rewrites dozens of them. Format only what changed:
  `{ git diff --name-only --diff-filter=AM -- src; git ls-files -o
  --exclude-standard src; }` filtered to `.ts/.tsx`, minus `generated`.
- **Do not `git stash` around `codegen:check`** — it rewrites the generated
  files and the pop then conflicts.
- **Install from the repo root with pnpm** (`pnpm --filter optitask-frontend
  add …`). Never npm or yarn.
- **After adding or changing any `*.operations.ts`**: `pnpm run codegen`, then
  `pnpm run depth:check`. Generated output is committed.
- **Import the router from `react-router` only**, not `react-router/dom`: under
  Vitest the two entry points load as separate module instances and
  `useRouteError` fails with "must be used within a data router".
- **Tests**: `renderRoutes(routes, { route })` for anything routed (real route
  tree, real guards); `renderWithProviders(ui)` for a lone component. Every
  rendered test must say who is signed in: `server.use(...signedIn())` or
  `...signedOut()` from `shared/tests/session.ts`, or the bootstrap request is
  unhandled. In `server.use(a, b)` the **first** matching handler wins, so a
  per-test override goes before a scenario spread. Use `mockQueryError` /
  `mockMutationError` for error responses — a hand-rolled helper returning
  `HttpResponse` fails the typecheck.
- **`<header>` inside `<main>`** is reported as a second `banner` by Testing
  Library; page headers are `<div>`s for that reason.
- **Test noise that is expected**: React logs every error a route boundary
  catches, and `act(...)` warnings from the auth bootstrap. Neither is a
  failure. The suite's exit code is what counts.
- The backend's `ROADMAP.md`, `known-debt.md`, `SECURITY.md` and `ready.md` are
  **gitignored** — they exist only on this machine.
- **Look before creating a file.** `git ls-files <module>` first: Phase 3 left
  a `notification.operations.ts` that Phase 11 overwrote without reading. It
  cost nothing that time; it could have.
- **Do not write files with a shell heredoc** when the text holds quotes and
  backticks: it failed twice with an unmatched-quote error. Use the
  editor tools, or put a script in a file and run that.
- **An `axe` failure is usually real.** In Phases 11 and 12 it found an
  unnamed popover and a skipped heading level. Fix the component, not the
  test.
- **A page-level test sees the whole shell.** Buttons such as "Open
  navigation" and the bell are on every screen; assert with `within(...)` a
  row, card or dialog rather than on `screen`.
- **A test whose handler answers a re-read must answer with the new state.**
  Several pages re-read after a change (the task after a status move, the
  queue after a decision). Use the fixtures' mutable `current` / `inbox` /
  `queue` objects and change them inside the mutation handler, or the page
  flips back.

---

## Notes from Phase 13 worth keeping

- **Where things live**: `modules/analytics`. `ProjectAnalytics.page.tsx` is
  the project's Analytics tab; `MyAnalytics` is the card on the viewer's own
  profile (live beside saved, with the save); `PersonAnalytics` is the card on
  someone else's, which asks only when its button is pressed.
  `UserAnalyticsTable` draws both.
- **Who may see what** (read from the backend source, not from `rbac.md`):
  `projectAnalytics` needs `analytics:view` at project scope, where a team
  role is not resolved — so a team lead who is a plain project member is
  refused, and the tab is hidden from them. `userAnalytics` is for the person
  and for owners and admins of an organisation they belong to.
  `recomputeUserStatistics` is in effect for the person alone.
- **Every profile test needs the analytics handlers**: the viewer's own
  profile reads `UserAnalytics` and `MyStatistics` on sight. Spread
  `myAnalyticsScenario()` from `analytics.fixtures.ts` (as `user.test.tsx`
  does in `beforeEach`). Someone else's profile asks for nothing until
  "Show analytics" is pressed.
- **Both analytics queries are `cache-and-network`**: the figures change with
  every task, so a revisit shows the cached ones and reads again behind them.
  A test that counts requests sees one per visit.
- **Following other people's work**: `useProjectAnalytics` listens with
  `useRealtimeEvent` and refetches. A test drives it by calling
  `announceRealtimeEvent` inside `act(...)`; no socket is needed.
- **A distribution lists every status and priority**, the empty ones as zero
  (`toStatusDistribution`); the API sends only those that hold a task. With
  no task at all the card shows an empty state instead of seven zeros.
- **A table cell that holds an avatar** reads as the initials plus the name
  ("TTTerry Teammate"). Assert the link or the other cells.
- **The analytics test file preloads the page** in `beforeAll`, as the sprint
  one does, because it brings the charting library.

---

## What is left

Phase 14 is done as far as an agent can take it. Each of these needs the
owner, or someone else:

| What | Whose | Detail |
|---|---|---|
| Contrast in Avero | Owner (Avero) | Six color pairs fail WCAG; empty-state text is worst at 1.4:1. The list, with ratios, is in known-debt, Phase 14. Two of them could be forced locally with a token override in `global.css` — the owner was asked on 2026-10-06 and had not answered when this was written |
| Deployment topology | Owner | Same site as the API, or not (risk R2). `docs/deployment.md` section 1 lays out the three shapes |
| A real deployment | Owner | The production build has only been served by `vite preview` on this machine |
| Switching CI on | Owner | `apps/frontend/ci/github-actions.ci.yml` is a template that has never run |
| A payload budget | Owner | Numbers are recorded in `CLIENT_PLAN.md`; none has been agreed |
| A screen-reader pass | A person | NVDA or VoiceOver over sign-in, the board, a task, the AI approval |
| Backend advisories | Backend | `pnpm audit --prod` lists eight, one critical (`proxy-addr` via Express 4) |
| A configurable rate limit | Backend | Would take the end-to-end run from nine minutes to about three |
| How the frontend reaches `dev`; pushing `main` | Owner | Unchanged — see Git state |

---

## The end-to-end suite

`apps/frontend/e2e/`, run with Playwright against the **real backend**. It is
the only place layout, colors, a real drag, a real socket and real cookies
are checked.

- **Running it**: `pnpm run e2e` (dev server) or `pnpm run e2e:build`
  (production build, served with the deployment's security headers). Both
  servers are started if they are not up. One file:
  `pnpm exec playwright test board`.
- **It uses the installed Chrome** (`channel: 'chrome'`), so nothing is
  downloaded. `E2E_BROWSER_CHANNEL=msedge` for Edge.
- **It writes to the backend's database** and does not clean up: accounts
  under `@e2e.optitask.test`.
- **It paces itself** under the API's 300 requests a minute
  (`support/pace.ts`). A test that sits for 50 seconds before starting is
  waiting for the minute to clear, not hanging.
- **Specs import `test` and `expect` from `./support/test`**, not from
  Playwright — that is what applies the pacing.
- **Arrange through the API, act through the browser**: `seedWorkspace()` in
  `support/api.ts` builds an organisation with a project, team, sprint, epic,
  tasks, comments and AI suggestions in about 45 requests.
- **A toast's text is on the page twice** — once in the toast, once in a live
  region. Use `toast(page, title)` from `support/app.ts`.
- **The connection badge reads "Live updates: Live"** to a locator; use
  `expectLive(page)`.
- **Creating an organisation, a project or a sprint opens it.** Do not click
  its link afterwards; wait for its heading.
- **The accessibility sweep has a known list** (`KNOWN_CONTRAST_PAIRS` in
  `sweep.e2e.ts`). It fails on anything not on it. When Avero fixes a pair,
  delete its line.
- **Looking at a screen**: `page.screenshot({ path, fullPage: true })` in a
  throwaway spec, then open the image. In a full-page screenshot a sticky
  sidebar looks cut short; it is not.

### Notes from Phase 14 worth keeping

- **A scroller must be a containing block.** `sr-only` is `position:
  absolute`; inside an `overflow-x-auto` element that is not positioned, it
  escapes and widens the page. `global.css` makes every `.overflow-x-auto`
  `relative`. A new scroller made some other way needs `relative` itself.
- **A grid that holds something wide needs `grid-cols-1`** at its narrowest:
  an implicit column is as wide as its widest item.
- **Charts are lazy inside their pages** (`SprintDetail.page`,
  `ProjectAnalytics.page`), behind `ChartSkeleton`. A test file that opens
  either preloads the chart component as well as the page in `beforeAll`.
- **`vite preview` sends the deployment's security headers**
  (`securityHeaders` in `vite.config.ts`), on port 5173. Change the policy
  there and in `docs/deployment.md` together.
- **Nothing is inlined into the CSS** (`assetsInlineLimit: 0`): a `data:` font
  would break `font-src 'self'`.
- **Source maps are written but not referenced** (`sourcemap: 'hidden'`).
- **`pnpm run build:check`** after a build: Avero's classes are in the CSS,
  no bare `@contracts`, no map pointer, nothing shaped like a secret.
- **Lint bans arbitrary colors** (`text-[#…]`, an inline `style` color).
- **`verify` now typechecks and lints `e2e/` too.**

---

### Notes from Phase 12 worth keeping

- **Where things live**: `modules/ai`. `RecommendationCard` is a view;
  `RecommendationDecision` holds approve / reject / override and their
  dialogs; `AiRequestPanel` asks for suggestions about one task or sprint and
  shows what came back; `AssignmentContextPanel` is the candidates table.
- **A requested suggestion is shown from the cache** (`useAiRecommendation`,
  a `useFragment`), not from the mutation's answer, so a decision on it —
  the viewer's or someone else's, heard over the socket — shows at once.
- **Reading `metadata`**: `readSuggestion` in `ai.utils.ts` is the only place
  that looks inside it, and trusts nothing about its shape.
- **After an applied decision**: `useAiDecisions` re-reads the task's two
  fields (`AiAppliedTaskQuery`) and announces `taskUpdated` inside the app. A
  test that approves an estimate or an assignment needs an `AiAppliedTask`
  handler; one that approves an insight must not need it.
- **Heading levels**: `RecommendationCard` takes `headingLevel` (3 on the
  queue, 4 inside a titled card) so the page outline has no gap; `axe`
  checks it.
- **Fixtures with the same id are the same entity** in the cache: two cards
  from one fixture function need different ids, or they render alike.

### Notes from Phase 11 worth keeping

- **One socket, one status**: `shared/services/realtime.client.ts` builds the
  link and owns the app-wide status (`idle | connecting | live | reconnecting
  | offline`). Creating a new link retires the previous one, which can then no
  longer report status — that is what keeps tests, and a hot reload, from
  showing a dead socket's state.
- **Subscribing**: `useRealtimeSubscription(document, { variables, onEvent })`
  in `shared/hooks/useRealtime.ts`. It is `no-cache` on purpose: the event
  reaches the cache only through `onEvent`. Use `isCached` before `writeEntity`
  so an event about something not loaded is dropped.
- **Passing an event on**: a reconciler may call `announceRealtimeEvent`, and
  a hook listens with `useRealtimeEvent` to re-read a figure the event does
  not carry (`useSprint`, `useEpic`, `useTask`). Re-read the smallest query
  that holds the figure (`SprintFiguresQuery`, `EpicProgressQuery`), not the
  page's main query, or its paged list returns to page one.
- **Testing realtime**: `createRealtimeServer()` + `createRealtimeTestClient`
  from `shared/tests/realtime.ts`; pass the client as `apolloClient` to
  `renderRoutes`. Call `setAccessToken('…')` first, or the socket starts with
  a refresh and needs a `Refresh` handler. `socket.push(operationName, data)`
  sends an event; `subscribed`, `drop`, `goDown`, `refuse` do the rest. Wait
  for `socket.subscribed(...)` before pushing.
- **Every signed-in test asks for the unread count**: `signedIn()` answers it
  with zero. A notification test puts `inboxScenario(...).handlers` first.
- **With the socket off** (`enableSubscriptions: false`, the default under
  test) a subscription goes to an inert link: it never emits and never fails.
- **What is announced**: the backend publishes `taskUpdated` for a task's
  details, status, assignee, estimate and sprint; `sprintUpdated` for a change
  of state; `commentAdded` for a new comment; `aiRecommendationUpdated` for a
  decision; `notificationReceived` for a new notification. Nothing else. Do
  not expect an event for a create or a delete.

### Notes from Phase 10 worth keeping

- **Where things live**: `modules/comment` owns comments *and* attachments, as
  the backend does. The task page mounts two section components,
  `TaskComments` and `TaskAttachments`, each making its own query — so a
  failed comment load is an error inside its card, not a failed page.
- **Every task page test loads a discussion**: `detailScenario` in
  `task.fixtures.ts` ends with `discussionScenario(TASK_ID)` (empty). A test
  about comments puts its own handlers first — see `taskPage()` in
  `comment.test.tsx`. `comment.fixtures.ts` must not import the task
  fixtures, or the two import each other.
- **Optimistic comment**: `createComment` writes a stand-in with an id from
  `nextPendingCommentId()`; `isPendingComment` hides its actions. The same
  `update` runs for the stand-in and the real comment. To test it, hold the
  mutation's response (`gate()` in `comment.test.tsx`). While one is in
  flight, the socket's echo of the viewer's own comment is ignored
  (`trackOwnComment`), or it would show twice.
- **Replies are one level**: the reply composer always sends the thread's
  first comment as `parentCommentId`.
- **Attachments are records, not files**: no file picker, no link, and
  `Attachment.url` is never selected (a standing test reads the operations
  file). Keep it that way until the backend stores files.
- **A link to a comment**: `taskCommentPath(projectId, taskId, commentId)`;
  `LinkedComment` reads `?comment=` and fetches it by id. A mention
  notification already links there.

### Notes from Phases 8 and 9 worth keeping

- **How the board stays consistent**: `buildBoardColumns`
  (`modules/task/utils/task.utils.ts`) places a card by the task's *current*
  status, not by the list it was fetched in. That is what makes the optimistic
  status change and its rollback work without editing any cached list. Do not
  replace it with per-list cache surgery.
- **One move, three inputs**: `modules/task/hooks/useBoardMove.ts` owns a card
  move. Dragging (`startDrag` / `aim` / `dropOn`), the keyboard (`pickUp` /
  `step` / `drop`) and a tap all go through it, and it announces each step.
  The drag library's own live region is silenced and parked in a hidden
  element, so there is one announcer.
- **Testing a drag**: `layOutColumns()` in `task.test.tsx` stubs
  `getBoundingClientRect` so the columns have places; then `fireEvent`
  `mouseDown` / `mouseMove` / `mouseUp`.
- **Windowing**: a column of more than `BOARD_WINDOW_THRESHOLD` (30) cards is
  windowed. Tests stub `offsetHeight` to give the list a height.
- **Server-computed figures are re-read, never patched**: adding or removing a
  sprint's task refetches the sprint (`refetchQueries: [SprintQuery]`); the
  same for an epic's milestones.
- **Deleting the entity a page shows**: `removeFromConnection` takes it out of
  the project's list without evicting the entity, so the page does not flash
  Not Found before it navigates away.
