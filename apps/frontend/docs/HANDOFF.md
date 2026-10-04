# Frontend Handoff

State of `apps/frontend` as of **2026-10-04**, written so a new session can pick
up without the previous conversation. Read this, then `CLIENT_PLAN.md` (the
phase tracker and Definition of Done) and `apps/frontend/docs/known-debt.md`
(every shortcut, with its right fix).

---

## Where things stand

**Progress: 61%** — Phases 0–7 and Amendment A1 are complete. **Phase 8 (Task —
Board, List & Detail) is built except for pointer dragging and list windowing**,
which need two packages that could not be installed; see "Phase 8" below.

| Phase | What exists |
|---|---|
| 0, 3 | Tooling, env validation, Apollo client, error normalization, codegen |
| A1 | Component library is **Avero** (`@averoui/react`) on **Tailwind v4**; light theme only; amber brand |
| 4 | Auth: login, register, forgot password, sessions, change password, accept invitation |
| 5 | Router, guards, app shell, breadcrumbs, command palette, error screens |
| 6 | Organisations (list, members, invitations, settings), own profile, other users' profiles |
| 7 | Projects (overview, status, members, workflow, settings), teams and team members |
| 8 | Tasks: board with keyboard and tap moves, filtered list, detail page with every task mutation |

Verified at handoff: `pnpm --filter optitask-frontend run verify` exits 0
(typecheck, lint, query-depth check, **423 tests in 18 files**) and
`run build` succeeds.

**Never verified:** nothing has been seen in a browser, and nothing has run
against the real backend. Every response in the tests is a mock shaped from the
SDL. Eight phases of UI are unseen — a visual pass at 360px and desktop width is
overdue and has been recommended to the owner more than once.

---

## Git state

| Branch | State |
|---|---|
| `frontend/F8` | Phase 8 so far. Pushed. **Not merged** — the phase is not complete. |
| `frontend/main` | Phases 0–7 + A1. Pushed, in sync with origin. |
| `main` | **Local is 2 commits ahead of `origin/main`** (the merge of the partner's amber `colors.md`). `git push origin main` is **rejected by a repository rule** — do not work around it; the owner must push or open a PR. |
| `ai/main` | The AI team's branch. Leave it alone. |
| `frontend/F5`, `F6`, `F7`, `averoui-migration` | Merged; kept locally. |

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

Still undecided, and worth raising:

- Whether to look at the app in a browser before more is built on it.
- Deployment topology (same registrable domain or not) — decides whether the
  `SameSite=Lax` cookies work in production (risk R2).

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
    ├── hooks/        useLoadMore, useErrorToast, useEscalateRouteError, useEntityIdParam
    ├── context/      AppProviders, apollo, breadcrumb
    ├── lib/          apiError, capabilities
    ├── routes/       route.constants.ts (ROUTES, path helpers, CRUMB_IDS), route.types.ts
    ├── services/     apollo.client, auth.gateway, session.store
    ├── utils/        date, form, id, cache
    ├── i18n/locales/en.json
    └── tests/        renderWithProviders, session, graphql, setup, server
```

### Patterns to follow (each exists; copy it)

- **A feature frame with tabs**: `modules/organization/Organization.page.tsx`
  and `modules/project/Project.page.tsx`. The frame makes the one query,
  resolves the viewer's roles, and hands both to its tabs through
  `<Outlet context>` + a typed `use<Feature>Context()` hook. Phase 8's Board,
  Backlog etc. become new tabs in `Project.page.tsx` and new nested routes.
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
- Avero has neither drag-and-drop nor virtualization; see Phase 8 below.
- `DatePicker` reports `YYYY-MM-DD` and parses typed `yyyy/mm/dd`. Convert
  with `dateInputToApi` / `apiToDateInput`.
- A `Select` cannot hold an empty value: "nothing chosen" needs a named
  sentinel option (see `TaskFilters`).
- Phase 9/13 charts: `@averoui/charts` (Recharts wrappers) exists but is not
  installed.

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

---

## Phase 8 — what is left

Tracker and exit criteria are in `CLIENT_PLAN.md`. Everything is ✅ except F8.2
(windowing) and F8.3 (pointer dragging).

- **Blocked on the network, not on design.** On 2026-10-04 the npm registry
  refused the TLS handshake from this machine (`curl` to registry.npmjs.org
  failed; GitHub worked), so `@dnd-kit/core` and `@tanstack/react-virtual`
  could not be installed. Try again first:
  `pnpm --filter optitask-frontend add @dnd-kit/core @tanstack/react-virtual`.
- **Pointer dragging** goes on top of `modules/task/hooks/useBoardMove.ts`,
  which already owns the move (pick up → target → drop, legal columns only,
  announcements, focus). A drag start is `pickUp`, entering a column sets the
  target, a release is `dropOn`. Keep the keyboard path as it is: it does not
  depend on geometry, which is why it can be tested in a DOM with no layout.
- **Windowing**: each `BoardColumn` renders its cards as `<li>` children. The
  test DOM has no layout, so a virtualizer renders nothing there — window only
  above a threshold, or stub the measured rect in tests.
- **How the board stays consistent**: `buildBoardColumns`
  (`modules/task/utils/task.utils.ts`) places a card by the task's *current*
  status, not by the list it was fetched in. That is what makes the optimistic
  status change and its rollback work without editing any cached list. Do not
  replace it with per-list cache surgery.
- **Then Phase 9.** `useProjectPlanning` and `ProjectPlanningQuery` already
  read `Project.sprints` / `Project.epics` for names; Phase 9's screens use the
  same cached fields and should take those documents over into their own
  modules.
