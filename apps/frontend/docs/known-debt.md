# Known Technical Debt / Intentional Shortcuts — Frontend

Each entry: what, why, what the "right" fix looks like, and impact if left
unfixed. Mirrors `apps/backend/docs/known-debt.md`.

---

## Phase 0 — Foundations

- **What**: accessibility assertions use `jest-axe` rather than `vitest-axe`.
- **Why**: `vitest-axe` is still a pre-release; `jest-axe` is a stable wrapper
  around the same `axe-core` engine and works under Vitest via
  `expect.extend(toHaveNoViolations)`.
- **Right fix**: swap to `vitest-axe` once it reaches a stable release, or drop
  both and call `axe-core` directly with a local matcher.
- **Impact**: none functionally — the audit engine is identical. Cosmetic
  dependency-naming mismatch only.

## Phase 1 — Design System & Theming

Superseded by Amendment A1 in `CLIENT_PLAN.md`: the token stylesheets, both
themes and the token gallery were removed, and their debt entries with them.

- **What**: `css: false` in the Vitest config — the stylesheet is not processed
  during tests.
- **Why**: the test DOM performs no layout and computes no styles, so running
  the Tailwind pipeline there would slow every run and assert nothing.
- **Right fix**: none needed. `vite build` compiles and validates the
  stylesheet.
- **Impact**: a class name that Tailwind does not generate (a typo, or an Avero
  class missed by `@source`) is invisible to the suite. It shows up only in
  the browser.

## Phase 2 — Shared Component Library

Superseded by Amendment A1: the in-house primitives were replaced by
`@averoui/react`. The entries below still apply, because Avero is built on the
same Radix primitives.

- **What**: the test environment is **happy-dom**, not jsdom.
- **Why**: jsdom implements no `PointerEvent`, `ResizeObserver` or
  `IntersectionObserver`. Radix opens every floating surface (menu, popover,
  tooltip, select) on pointer events and positions it with floating-ui's
  `autoUpdate`, which constructs an IntersectionObserver. Under jsdom those
  components never opened, and the throw inside an effect made React retry
  forever — so tests **hung for 20–30s and timed out with no error** instead of
  failing usefully. The same suite runs in ~90ms under happy-dom.
- **Right fix**: none needed. Polyfills for the missing APIs are kept in
  `setup.ts` anyway so the suite still works if the environment is switched back.
- **Impact**: happy-dom is a different DOM implementation from the browser, so a
  behaviour difference could hide in either direction. The Phase 14 E2E suite
  runs against a real browser and is what actually certifies these components.

- **What**: `userEvent.setup` runs with `pointerEventsCheck: 0` and `delay: null`.
- **Why**: Radix sets `pointer-events: none` on `<body>` while a dismissable
  layer is open (that is how it makes the page inert), which stalls userEvent's
  pointer-events check. The default inter-event delay also interleaves with
  Radix's own timers and made surfaces open nondeterministically.
- **Right fix**: none — neither check protects anything in a headless DOM that
  performs no hit-testing.
- **Impact**: a genuine `pointer-events: none` regression on a control would not
  be caught by the component suite. Reachable only via the E2E suite.

- **What**: `auditA11y` disables the `region` and `aria-hidden-focus` axe rules.
- **Why**: `region` requires page landmarks, which an isolated component does
  not have. `aria-hidden-focus` fires on Radix's own focus sentinels
  (`span[data-radix-focus-guard]`) — intentionally focusable, zero-size,
  pointer-events:none elements implementing the focus trap.
- **Right fix**: the Phase 14 full-route sweep audits with **both rules on**,
  where landmarks exist and the finding would be real.
- **Impact**: a component that genuinely hides focusable content behind
  `aria-hidden` would not be flagged at the component level.

## Phase 3 — GraphQL Data Layer

- **What**: the error-normalization link converts a 200 response carrying
  `errors` into a thrown error, rather than letting it through as a result.
- **Why**: Apollo Client 4 raises `CombinedGraphQLErrors` *above* the link
  chain, so no link can observe a GraphQL error — which meant the refresh link
  could never see `UNAUTHENTICATED` and the session could never be renewed.
  Converting the result puts transport and GraphQL failures on one path.
- **Right fix**: none available while auth failures arrive as GraphQL errors in
  a 200 response.
- **Impact**: `errorPolicy: 'all'` no longer yields partial data — a response
  with both `data` and `errors` surfaces as an error. The API returns
  `data: null` alongside a typed error, so nothing relies on that today. A
  future partial-data field would need this link to special-case it.

- **What**: `refreshSession()` uses a bare `fetch`, not an Apollo operation, and
  the mutation is written as a raw string rather than a generated document.
- **Why**: a refresh triggered *by* the auth link would re-enter that same link;
  any bug there becomes an infinite loop. A direct request cannot recurse.
- **Right fix**: none — the isolation is the point. The string is one field
  deep and asserted by the refresh tests.
- **Impact**: this one operation is not covered by codegen, so a rename of
  `refreshToken` would not be caught at compile time.

- **What**: `session.store.ts` landed in Phase 3 rather than Phase 4 (F4.1).
- **Why**: the WebSocket link authenticates through `connectionParams`, so the
  in-memory token had to exist before the client could be built.
- **Right fix**: none; Phase 4 builds the auth flow on top of it.
- **Impact**: none. Tracked as F3.11.

- **What**: ~~the request id is invisible cross-origin~~ — RESOLVED.
- **Why**: prerequisite P3 was outstanding.
- **Right fix**: done — the backend now sends
  `Access-Control-Expose-Headers: x-request-id`.
- **Impact**: none. `ApiError.requestId` is populated in both same-origin tests
  and a real cross-origin deployment.

## Phase 4 — Auth & Session

- **What**: the password policy is expressed twice — in
  `modules/auth/schemas/auth.schema.ts` and in the backend's
  `auth.validation.ts`.
- **Why**: the API's `extensions` carries a `code` and nothing else, so a server
  rejection can only ever be rendered as a form-level error. Duplicating the
  rules is what lets a user see *which* field is wrong.
- **Right fix**: move the policy into `@contracts` as a shared zod schema, so
  both sides import one definition. That is a backend change too, so it was not
  bundled into a frontend phase.
- **Impact**: a policy change on the server that is not mirrored here shows up
  as a confusing form-level error instead of a field hint. `auth.test.tsx`
  asserts the exact boundaries, so the drift is at least visible.

- **What**: `requestPasswordReset` is wired in `auth.operations.ts` but no
  screen calls it, and `ForgotPassword.page.tsx` offers no email field.
- **Why**: the backend mutation validates the address and returns success while
  issuing no token and sending no mail. A form that appears to work would leave
  users waiting for an email that never arrives.
- **Right fix**: when the backend grows a reset-token table, turn that page into
  a real form; the operation is already defined.
- **Impact**: users cannot self-serve a forgotten password. The screen says so.

## Phase 5 — App Shell, Routing & Guards

- **What**: the shell has no organisation/project switcher and no notification
  bell, both of which F5.2 originally listed.
- **Why**: each needs a query owned by a later phase (`myOrganizations` in
  Phase 6, `Organization.projects` in Phase 7, the notification feed in Phase
  11). A switcher with nothing to switch between would be a dead control.
- **Right fix**: F7.2 adds a project switcher to the sidebar and F11.1 adds the
  bell to the top bar; both slots are plain JSX in `AppLayout` and `Topbar`.
- **Impact**: organisations are reached through the sidebar's Organisations
  destination (added in Phase 6), not a switcher.

- **What**: the shell is built from Avero's `SidebarNav`, `Drawer`,
  `DropdownMenu` and `Avatar`, not from its `DashboardShell`.
- **Why**: `DashboardShell` is the chrome of a content site's account area — a
  one-third sidebar card beside a two-thirds content card, under large top
  margins, with no top bar. An application frame needs a fixed sidebar, a
  sticky top bar and a full-width content region.
- **Right fix**: none needed, unless Avero grows an application shell; then
  `AppLayout` should adopt it.
- **Impact**: `AppLayout`'s layout classes are ours to maintain.

- **What**: a query's `FORBIDDEN` or `NOT_FOUND` becomes the Forbidden or Not
  Found screen only if the page calls `useEscalateRouteError(error)`.
- **Why**: Apollo's query hooks return errors instead of throwing them, so the
  route's error boundary never sees one unless the page hands it over.
- **Right fix**: have each feature's query hooks escalate, so a page cannot
  forget; or move page-level reads to suspense queries, which throw.
- **Impact**: a page that forgets the call shows its inline error state for a
  forbidden resource — safe and honest, but not the dedicated screen.

- **What**: `shared/lib/capabilities.ts` is a hand-written copy of the
  backend's role → permission matrix.
- **Why**: the matrix is deliberately server-side only (`@contracts` shares the
  vocabulary, not the authority), and an app may not import another app's
  source.
- **Right fix**: have the API return the caller's permissions on each resource
  (e.g. `Project.viewerPermissions`), and delete the table.
- **Impact**: the table can drift from the server. It only ever hides or shows
  a control — the server still decides — so drift is a UX bug, not a security
  one. `capabilities.test.ts` pins the boundary cells against `rbac.md`.

- **What**: the current item in the sidebar is white text on the amber brand
  color.
- **Why**: Avero's `SidebarNavItem` hard-codes `text-white` on `bg-primary`,
  the same cause as the primary button (see Amendment A1).
- **Right fix**: the same upstream `--color-primary-foreground` token.
- **Impact**: the current page's label fails contrast in the sidebar.

- **What**: an unknown path shows Not Found only to a signed-in user; a
  signed-out visitor is redirected to sign in first.
- **Why**: the catch-all route sits behind the auth guard, so the response to
  any path is the same until the visitor has a session.
- **Right fix**: none — this is deliberate. A public catch-all would let anyone
  probe which paths exist.
- **Impact**: a mistyped public URL lands on the sign-in screen, not on a 404.

- **What**: `Home.page.tsx` shows a greeting and an organisation count, taken
  from the session, and nothing else.
- **Why**: the real landing content is the organisation list, which is Phase 6.
- **Right fix**: Phase 6 replaces the summary.
- **Impact**: none; the page states only what it knows.

- **What**: the command palette offers navigation and sign-out, not search
  across projects or tasks.
- **Why**: entity search needs each feature's queries.
- **Right fix**: each feature phase registers its own results.
- **Impact**: the "Search" button in the top bar is, for now, a jump menu.

- **What**: the shell has not been seen in a browser, and its responsive
  behaviour is unverified.
- **Why**: the test DOM performs no layout; no browser was available to the
  agent that built it.
- **Right fix**: a manual pass at 360px and desktop width now, and the Phase 14
  browser E2E suite later.
- **Impact**: overflow, spacing and the `lg` switch between sidebar and drawer
  are asserted structurally only.

## Phase 6 — Organization & Members

- **What**: an invitation cannot actually be accepted by the person invited.
- **Why**: a backend gap, not a client one. `inviteToOrganization` stores a
  token but sends no email (the email adapter is a no-op), and
  `OrganizationInvitation` does not expose the token — so neither the invitee
  nor the inviter ever sees the link.
- **Right fix**: in the backend, either deliver the link by email or return an
  accept URL to the inviter so it can be copied. The client's accept screen
  (`/invitations/:token`) already works.
- **Impact**: the invitations tab records, lists and revokes invitations, and
  says in a warning that they are not delivered. Until the backend changes, the
  only way to add someone to an organisation is outside the UI.

- **What**: the viewer's role on an organisation is inferred from the member
  list rather than given by the API.
- **Why**: `Organization` exposes the owner and the members, but nothing like
  `viewerRole`. The list is paginated, so an admin whose own row is beyond the
  first page is treated as a plain member until it loads.
- **Right fix**: an `Organization.viewerRole` (or `viewerPermissions`) field.
- **Impact**: in an organisation with more than one page of members, an admin
  can be shown fewer controls than they are entitled to. Never more — the
  fallback is the least-privileged reading.

- **What**: avatars and logos are set by pasting a URL.
- **Why**: the API has no upload; `avatarUrl` and `logoUrl` are plain strings.
- **Right fix**: real file storage on the backend, then an upload control.
- **Impact**: an image must already be hosted somewhere. The forms say so.

- **What**: the profile shows the email address read-only.
- **Why**: no operation changes it.
- **Right fix**: a verified change-email flow on the backend.
- **Impact**: a user cannot correct their own address.

- **What**: `codegen:check` reports the generated files as stale on a Windows
  checkout, even immediately after regenerating.
- **Why**: the repository is checked out with `core.autocrlf=true`, so the
  files on disk are CRLF while codegen writes LF; the check compares bytes.
- **Right fix**: a `.gitattributes` that pins generated files (or the whole
  repo) to `eol=lf`.
- **Impact**: the drift check is only trustworthy on a Linux runner. Locally,
  regenerate and read `git diff` instead.

- **What**: the test setup patches `Element.prototype.animate`, raises the
  async-query timeout to 5s and the test timeout to 20s.
- **Why**: happy-dom rejects a cancelled animation's `finished` promise without
  marking it handled, so every test that showed a toast reported an unhandled
  `AbortError`; and route-level tests wait on real dynamic imports, which
  outlast the 1s default under a parallel run.
- **Right fix**: none needed for the timeouts. The animation patch can go if
  happy-dom follows the spec here.
- **Impact**: a genuinely slow screen takes longer to fail a test.

## Phase 7 — Project & Team

- **What**: a people picker only offers people from the first page of the
  membership it is fed.
- **Why**: candidates come from lists the screen already loaded — organisation
  members for a project, project members for a team — and those load 20 at a
  time. There is no API to search a membership by name.
- **Right fix**: a server-side search on scoped membership (e.g.
  `Organization.members(search:)`), which the picker queries as the user types.
- **Impact**: in an organisation or project with more than 20 members, someone
  beyond the first page cannot be picked until "Load more" on the members tab
  has brought their row in.

- **What**: the viewer's roles on a project and on a team are inferred, and
  inferring them needs the organisation's member list too.
- **Why**: as with organisations, the API states no `viewerRole`. Organisation
  owners and admins hold project powers without being project members, so the
  project screen reads the organisation as well.
- **Right fix**: `viewerPermissions` on `Project` and `Team`.
- **Impact**: one extra query per project screen, and the same pagination
  blind spot as Phase 6. A project member outside the organisation is refused
  that read and simply gets no organisation-level hints, which is correct.

- **What**: there is no list of "my projects" — a project is reached through
  its organisation.
- **Why**: the API has `Organization.projects` and `project(id)`, but no query
  for the projects a user belongs to.
- **Right fix**: a `myProjects` query, and with it a sidebar project switcher.
- **Impact**: a user on projects in several organisations has to go through
  each organisation to find them.

- **What**: the project's tabs are Overview, Members, Teams and Settings only.
- **Why**: Board, Backlog, Sprints, Epics, Analytics and AI belong to Phases
  8–13. A tab is added with the screen behind it.
- **Right fix**: each phase adds its tab to `Project.page.tsx`.
- **Impact**: none; nothing links to a screen that does not exist.

- **What**: the workload field is a bare number from 0 to 1000 with no unit.
- **Why**: the API defines `workload: Int` and nothing documents what one unit
  means.
- **Right fix**: decide and document the unit on the backend (open tasks?
  story points? hours?), then label the field with it.
- **Impact**: two leads can enter numbers on different scales, and the AI
  assignment suggestions compare them as if they were the same.

- **What**: the project-member picker offers only organisation members, though
  the API would accept any user id.
- **Why**: offering anyone else would need the global `users` directory, which
  lists every account in the system.
- **Right fix**: none on the client. Arguably the backend should require
  organisation membership before adding someone to a project.
- **Impact**: none through the UI.

## Phase 8 — Task: Board, List & Detail

- **What**: a card cannot be dragged with a pointer. It is moved by picking it
  up (its move button) and choosing a column — arrow keys and Enter, or a tap
  on the column's "Move here".
- **Why**: `@dnd-kit/core` could not be installed: the npm registry refused the
  TLS handshake from the build machine on 2026-10-04 (GitHub was reachable).
- **Right fix**: install it and add a pointer sensor on top of `useBoardMove`,
  which already holds the whole move: a drag is a pick-up, hovering a column
  sets the target, releasing is a drop.
- **Impact**: the board works with a keyboard, a mouse and a touch screen, but
  not by direct manipulation, which is what people expect of a board.

- **What**: board columns are not windowed. Every loaded card is in the DOM;
  off-screen ones skip layout and paint through `content-visibility: auto`.
- **Why**: `@tanstack/react-virtual` could not be installed, for the same
  reason.
- **Right fix**: window each column's list, then profile a 200-card board.
- **Impact**: a column loads 50 cards at a time, so the DOM grows with each
  "load more". The 60fps exit criterion is unmeasured. `content-visibility` is
  not supported by older Safari, where every card is laid out.

- **What**: a status change does not move a task between cached lists. The
  board places a card by the task's current status instead, and corrects each
  column's count for the cards that have moved (`buildBoardColumns`).
- **Why**: a task list is cached once per filter, and editing seven lists by
  hand on every optimistic change and every rollback is where such code breaks.
- **Right fix**: none needed for the board. The task list is different — see
  the next entry.
- **Impact**: none on the board.

- **What**: on the task list, a row whose task no longer matches the filter
  stays until the list is next fetched.
- **Why**: the same cached-list design; the list shows what the server last
  returned for that filter.
- **Right fix**: Phase 11's `taskUpdated` subscription can refetch the list
  being shown, or drop the row when its task stops matching.
- **Impact**: after changing a task elsewhere, a filtered list can show it
  until a reload or a filter change.

- **What**: the label filter offers only labels seen on tasks loaded so far.
- **Why**: the API has no list of a project's labels; a label is only ever
  visible on a task.
- **Right fix**: a `Project.labels` field.
- **Impact**: a label used only by tasks beyond the loaded pages cannot be
  filtered by.

- **What**: a label's `color` is ignored.
- **Why**: it is a free-form string from the server, and the working agreement
  rules out inline and arbitrary colors. No mutation sets it anyway.
- **Right fix**: constrain it server-side to a named palette that maps to
  theme tokens.
- **Impact**: none today; every label's color is null.

- **What**: sprints, epics and dependency candidates are read as one page of
  100, with no "load more".
- **Why**: they feed pickers and name lookups; the real sprint and epic screens
  are Phase 9, and there is no task search.
- **Right fix**: Phase 9 pages the sprint and epic lists; a server-side task
  search would replace the dependency picker's list.
- **Impact**: beyond 100, a sprint or epic shows as "no longer listed", and
  only the 100 most recent tasks can be picked as a dependency.

- **What**: a rejected dependency is always explained as a loop.
- **Why**: the API returns only `BAD_USER_INPUT`. The picker never offers the
  task itself or one already depended on, so within this UI a rejection is the
  cycle check — but a dependency in another project, made by some other
  client's data, would get the same sentence.
- **Right fix**: distinct error codes, or field errors, from the API.
- **Impact**: a wrong explanation in a case this UI cannot produce.

- **What**: the detail page re-reads the whole task after each audited change
  (status, assignee, estimate, sprint) to pick up the new activity entry.
- **Why**: the mutations return the task, not the activity they wrote.
- **Right fix**: Phase 11's `taskUpdated` subscription.
- **Impact**: one extra request per change, and a paged-out activity list
  returns to its first page.

- **What**: the assignee picker and the assignee filter list only project
  members from the first loaded page; an assignee who is not a project member
  cannot be picked, though the API would accept any user.
- **Why**: the same scoped-membership rule as Phase 7's pickers.
- **Right fix**: the membership search described under Phase 7.
- **Impact**: as Phase 7.

- **What**: `estimatedSeconds` is not shown.
- **Why**: no mutation sets it, so it is always null.
- **Right fix**: surface it when the API can write it.
- **Impact**: none.

- **What**: `SelectField` gives its trigger an `aria-label` in addition to the
  `<label for>` that already names it.
- **Why**: the trigger is a `<button role="combobox">`. axe does not follow a
  label to a button, and a combobox's text is its value, not its name, so every
  select on a page failed the `button-name` audit. Phase 8 was the first page
  audit to include one.
- **Right fix**: have Avero's `Field` label its select trigger with
  `aria-labelledby`.
- **Impact**: none; both names are the same text.

## Amendment A1 — Avero migration

- **What**: Avero's filled primary button is white text on the amber brand
  color — about 2:1, and about 3:1 on hover.
- **Why**: Avero hard-codes `text-white` on `bg-primary`; it was designed
  around a dark blue. The contrast depends on the brand color, and amber is
  light.
- **Right fix**: upstream, in Avero — a `--color-primary-foreground` token that
  the filled variants read, set to a dark value here. Not worked around locally
  by decision.
- **Impact**: every primary action fails WCAG 1.4.3 (4.5:1). This blocks the
  Phase 14 accessibility sign-off. `AuthLayout`'s brand panel is ours and
  already uses dark text.

- **What**: warning `Alert`, `Toast` and `Badge` tones are still amber, the
  same hue as the brand.
- **Why**: `global.css` moves `--color-warning` to orange, but Avero only
  reads that token in the `warning` Button variant. The other components use
  Tailwind's `amber-*` palette directly.
- **Right fix**: upstream — have those tones read the warning tokens.
  Overriding Tailwind's whole `amber` palette here would work but silently
  recolors anything else that uses it.
- **Impact**: a warning alert can be read as a brand accent rather than a
  caution. The icon and wording still carry the meaning.

- **What**: light theme only; the theme provider, the persisted preference and
  the pre-paint script were removed.
- **Why**: Avero ships no dark variants (decision D9).
- **Right fix**: dark support in Avero first, then a theme switch here.
- **Impact**: users who prefer a dark interface get a light one.

- **What**: two i18n systems run side by side — `react-i18next` for the app's
  strings and Avero's own dictionary for strings inside its components.
- **Why**: Avero carries built-in labels ("Close", "Cancel", the toast region
  name) and resolves them from `AveroProvider locale`.
- **Right fix**: when a second locale is added, drive `AveroProvider`'s
  `locale` from the i18next language so the two cannot disagree.
- **Impact**: none while the app ships `en` only. The locale is a constant in
  `AppProviders.tsx`.

- **What**: `global.css` points `@source` at
  `node_modules/@averoui/react/dist` by relative path.
- **Why**: Tailwind v4 scans only the app's own source, so Avero's class names
  must be added to the scan explicitly.
- **Right fix**: none available until Avero ships a precompiled stylesheet.
- **Impact**: moving `global.css`, or a change in where pnpm links the package,
  breaks the path and every Avero component renders unstyled — with no type,
  lint or test failure. The build check in Amendment A1 (grep the compiled CSS
  for an Avero class) is the only guard; make it a CI step in Phase 14.

- **What**: ~~Avero's `DatePicker` output format is unverified~~ — RESOLVED in
  Phase 8.
- **Why**: the in-house picker and its RFC-3339 tests were removed with A1.
- **Right fix**: done. The picker reports `YYYY-MM-DD`; `dateInputToApi`
  (`shared/utils/date.utils.ts`) turns it into a full instant, and the create
  task test asserts the value on the wire.
- **Impact**: none. A date typed in a shape the picker does not parse is
  reported as empty, so it is sent as "no date" rather than flagged.

- **What**: Avero has no breadcrumbs, keyboard-key, classic tabs or command
  palette component.
- **Why**: outside its current scope.
- **Right fix**: build each in `shared/components` when its phase needs it
  (breadcrumbs and the command palette in Phase 5), or add it to Avero.
- **Impact**: breadcrumbs now live in `shared/components` and the command
  palette is `cmdk` inside Avero's `Dialog` (both Phase 5). Tabs and a
  keyboard-key component are still to come.

## Monorepo / tooling

- **What**: the frontend runs **Vitest 3** while the backend runs Vitest 2.
- **Why**: Vitest 2 pins Vite 5. With Vite 6 in the app, `vitest/config`'s
  `defineConfig` was typed against Vite 5 while `@vitejs/plugin-react` resolved
  against Vite 6, producing an unresolvable `PluginOption` type conflict under
  `exactOptionalPropertyTypes`. The choices were Vite 5 + Vitest 2, or Vite 6 +
  Vitest 3; the forward-looking pair won.
- **Right fix**: bump the backend to Vitest 3 so both apps share a major. The
  two suites are independent, so this is housekeeping, not a blocker.
- **Impact**: two Vitest majors in one repo. Config options and matchers differ
  slightly between them, so a snippet copied from the backend suite may need
  adjusting.

- **What**: the `@contracts` specifier is mapped in **two** places
  (`tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`) rather than
  resolving through the workspace symlink.
- **Why**: inherited from the workspace design — `@contracts` is a bare scope
  with no package name, which Node's ESM resolver rejects
  (`ERR_INVALID_MODULE_SPECIFIER`). See the backend's matching entry.
- **Right fix**: rename the package to a valid scoped name (e.g.
  `@optitask/contracts`) and delete both mappings.
- **Impact**: dropping either mapping breaks the app at runtime while it still
  type-checks. `src/shared/tests/contracts.test.ts` exists to catch exactly
  that, and asserts on **values**, not types.
