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

- **What**: dragging a card is tested with synthetic mouse events over column
  rectangles the test supplies, and has never been tried in a browser.
- **Why**: the test DOM performs no layout, so the drag library would measure
  every column as an empty box; no browser was available to the agent.
- **Right fix**: a manual pass with a mouse and on a touch screen now, and a
  drag in the Phase 14 browser E2E suite.
- **Impact**: the logic is covered — a legal column takes the card, an illegal
  one or empty space lets it go, a viewer cannot drag. The feel is not: the
  8px mouse threshold, the 250ms touch hold (which on some phones competes with
  the link's long-press menu) and auto-scroll near the board's edge.

- **What**: the 60fps criterion for a 200-card board is unmeasured.
- **Why**: it needs a browser's performance panel.
- **Right fix**: profile a seeded 200-card board; tune `BOARD_WINDOW_THRESHOLD`
  and the card height estimate in `task.constants.ts` from what it shows.
- **Impact**: a column past 30 cards is windowed, so the number of cards in
  the DOM is bounded; whether scrolling is smooth is not known.

- **What**: a windowed column scrolls inside itself (at most 70% of the
  viewport height), while a short column grows with the page.
- **Why**: a window needs a scroll container of its own to measure against.
- **Right fix**: none needed, unless the two behaviours side by side read as
  inconsistent in the browser — then give every column the same height cap.
- **Impact**: a board can show columns that scroll and columns that do not.

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
- **Right fix**: drop the row when its task stops matching the filter on
  screen. Phase 11's `taskUpdated` now keeps the row's own fields current, but
  deliberately does not refetch the list: that would return a list paged to
  its third page to its first every time anyone touched a task.
- **Impact**: after a task is changed, here or by someone else, a filtered
  list can go on showing it until a reload or a filter change.

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
- **Right fix**: an event (or a mutation result) that carries the activity
  entry, so it can be added without re-reading. Phase 11's `taskUpdated`
  carries the task only, so the page still re-reads — now also when someone
  else changes the task, and twice for one's own change (once from the page,
  once from the echo). The page's own re-read stays because the socket may be
  down.
- **Impact**: up to two extra requests per change, and a paged-out activity
  list returns to its first page.

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

## Phase 9 — Sprint & Epic

- **What**: the burndown chart has never been drawn.
- **Why**: the test DOM has no size, so Recharts' `ResponsiveContainer` renders
  nothing there; no browser was available to the agent. The tests assert the
  chart's data table and both empty states instead.
- **Right fix**: a manual look now, and a screenshot in the Phase 14 browser
  suite.
- **Impact**: axis labels, the two lines and the tooltip are unverified. A long
  sprint's day labels may crowd the x axis.

- **What**: the burndown's data table is visible to assistive technology only.
- **Why**: Avero's `LineChart` renders its `ChartDataTable` with `sr-only`.
- **Right fix**: an opt-in visible table (or a "show as table" toggle) in
  `@averoui/charts`.
- **Impact**: a sighted person who cannot read the chart — low vision, a
  small screen — has no figures to fall back on.

- **What**: the sprint page's chunk is about 112 kB gzip, nearly all Recharts.
- **Why**: `@averoui/charts` wraps Recharts and the page imports it directly.
- **Right fix**: load the burndown lazily inside the page, so the figures and
  the task list do not wait on the chart; decide in Phase 14's bundle pass,
  when Phase 13's charts exist too.
- **Impact**: the first visit to any sprint downloads the charting library.
  No other route pays for it.

- **What**: `@averoui/charts` 2.0.0 depends on `@averoui/tokens` ^1, so two
  token versions are installed (1.0.1 for charts, 2.2.1 for everything else).
- **Why**: the chart package has not been released against tokens 2.
- **Right fix**: release `@averoui/charts` against the current tokens.
- **Impact**: the series colors are Avero's chart palette from the older token
  set (indigo and rose), unrelated to the amber brand. Consistent with
  themselves, and none is hard-coded here.

- **What**: workload per assignee is a table with a bar per row, not a chart.
- **Why**: Avero ships line and area charts only, and a bar chart built here
  would be a primitive Avero lacks, with raw Recharts colors.
- **Right fix**: a `BarChart` in `@averoui/charts`, if a chart reads better
  than the table once seen.
- **Impact**: none functionally; every figure is shown as a number.

- **What**: the stored epic progress cannot be shown, only the live one.
- **Why**: `Epic.progress` is always computed on read. `refreshEpicProgress`
  writes a column no field exposes.
- **Right fix**: expose the stored value and when it was saved (e.g.
  `Epic.storedProgress`, `progressRefreshedAt`), or drop the mutation.
- **Impact**: "Save progress" changes nothing the user can see. The screen
  says so in a sentence rather than showing two figures.

- **What**: a milestone can only be created on an epic, and cannot be edited.
- **Why**: `Epic.milestones` is the only place milestones are listed, so one
  created without an epic would be stored and never seen again; and the API
  has no `updateMilestone`.
- **Right fix**: `Project.milestones` and `updateMilestone` on the backend.
- **Impact**: no project-level milestones. To change one, delete and recreate.

- **What**: a task cannot be moved into or out of an epic after it is created.
- **Why**: `UpdateTaskInput` has no `epicId`, and no epic mutation takes a
  task.
- **Right fix**: `epicId` on `UpdateTaskInput`, or `addTaskToEpic` /
  `removeTaskFromEpic`.
- **Impact**: the epic page lists its tasks read-only, and its empty state
  says a task joins an epic when it is created.

- **What**: the sprint's "add a task" picker offers only the project's 100
  most recent tasks.
- **Why**: there is no task search, and no filter for "not in this sprint".
- **Right fix**: a server-side task search, as for the dependency picker.
- **Impact**: an older task is added from its own page (Move to sprint).

- **What**: `ProjectPlanningQuery` still lives in the task module.
- **Why**: it reads sprint and epic names in one request for the task
  screens; splitting it across the two new modules would turn that into two.
- **Right fix**: none needed. It and the sprint and epic lists read the same
  cached `Project.sprints` / `Project.epics`, so a new sprint or epic shows up
  in the task pickers without a reload.
- **Impact**: none. The two write the same cached list at different page
  sizes (100 and 20); whichever answered last decides how many are cached.

- **What**: `sprint.test.tsx` imports the sprint page once before its tests.
- **Why**: the first import of the charting library under a parallel run can
  outlast a query's 5s timeout, which failed whichever test opened the page
  first.
- **Right fix**: none needed.
- **Impact**: none; the page is still loaded lazily by the router under test.

## Phase 10 — Collaboration: Comments & Attachments

- **What**: replies go one level deep. A reply is always filed under its
  thread's first comment, and a reply to a reply — which the API allows and
  another client could make — is not shown.
- **Why**: `Comment.replies` is a plain list on each comment, so every further
  level is another level of nesting in the query, and the API has no way to ask
  for "all descendants".
- **Right fix**: a flat `Comment.thread` (or paginated `replies`) on the
  backend; or decide that one level is the product rule and have the API
  refuse deeper ones.
- **Impact**: none for comments written here. A deeper reply made elsewhere is
  stored, counted nowhere on this screen, and invisible.

- **What**: a thread's replies are not paginated.
- **Why**: the API returns them as one list.
- **Right fix**: a `replies(first:, after:)` connection.
- **Impact**: a thread with hundreds of replies loads them all at once.

- **What**: an attachment is typed in by hand — name, type, size — and there
  is no file picker.
- **Why**: the API stores a record and never the file (backend debt). Picking
  a file would look like an upload that does not happen, even if only its name
  were read.
- **Right fix**: real storage on the backend (an upload URL, a signed download
  URL), then an upload control and a link.
- **Impact**: attachments are notes that a file exists. The card, the form
  and the removal dialog each say so. `Attachment.url` is never selected, and
  a standing test keeps it that way.

- **What**: the largest size that can be recorded is 2,147,483,647 bytes
  (about 2 GB), though the backend's own rule allows 5,000,000,000.
- **Why**: `AddAttachmentInput.sizeBytes` is a GraphQL `Int`, which cannot
  carry a larger number; the server's higher bound is unreachable.
- **Right fix**: on the backend, a `Float` or a string-encoded size for the
  input, as the output already uses `Float`.
- **Impact**: a file larger than 2 GB cannot have its size recorded; leave the
  size blank.

- **What**: an edit changes a comment's text only; who it mentions cannot be
  changed afterwards.
- **Why**: `UpdateCommentInput` has `body` and nothing else.
- **Right fix**: `mentionedUserIds` on `UpdateCommentInput`, notifying only
  the people newly added.
- **Impact**: to mention someone who was missed, write a reply. The edit form
  says the mentions stay as they are.

- **What**: only project members on the first loaded page can be mentioned.
- **Why**: the same scoped-membership rule as every other picker (Phase 7).
  The API would accept any user id — it checks only that the user exists.
- **Right fix**: the membership search described under Phase 7.
- **Impact**: as Phase 7.

- **What**: a new comment is shown at the end of the list even when later
  pages have not been loaded, so it can sit below comments it does not
  directly follow.
- **Why**: the person who wrote it should see it at once. It is added without
  a cursor, so loading the next page drops it and brings it back in its true
  place with its own page.
- **Right fix**: none needed.
- **Impact**: between posting and loading more, the count reads "Showing 21
  of 45" with the new comment last. With more than one page still to load,
  it leaves the screen until its page arrives.

- **What**: ~~someone else's comment does not appear until the thread is next
  fetched~~ — RESOLVED in Phase 11.
- **Why**: nothing listened for it.
- **Right fix**: done. `commentAdded` files the comment at the end of the
  thread or under its parent.
- **Impact**: none for a new comment. An edit, a resolve or a delete made by
  someone else still arrives only with the next fetch: the API publishes an
  event for a new comment and for nothing else.

- **What**: the linked comment is shown read-only in a panel above the
  thread, and — when it is on a loaded page — a second time in the thread.
  The page does not scroll to it.
- **Why**: a link can name a reply, or a comment on a page not yet loaded, so
  it is fetched by id rather than looked for in the list. Scrolling cannot be
  tested without layout and was left out rather than guessed at.
- **Right fix**: once seen in a browser, either keep the panel or highlight
  and scroll to the comment in place when it is loaded.
- **Impact**: a duplicate on screen until the panel is dismissed.

- **What**: "Copy link" needs clipboard access.
- **Why**: `navigator.clipboard` exists only on a secure origin (HTTPS or
  localhost) and can be refused.
- **Right fix**: none needed; the failure is reported in a toast.
- **Impact**: on a plain-HTTP deployment the button reports that it could not
  copy.

- **What**: each comment carries its actions as a row of small buttons — up
  to six (reply, resolve, edit, record a file, copy link, delete).
- **Why**: a menu would hide them behind another click, and nothing has been
  seen in a browser to judge which reads better.
- **Right fix**: after a visual pass, move the less-used ones into a
  `DropdownMenu` if the row is cluttered.
- **Impact**: possibly a busy thread on a narrow screen. The row wraps.

- **What**: a new comment re-reads the whole task to pick up its entry in the
  audit trail.
- **Why**: as in Phase 8 — the mutation returns the comment, not the activity
  it wrote.
- **Right fix**: as in Phase 8. `taskUpdated` is not published for a comment,
  so the subscription does not cover this.
- **Impact**: one extra request per comment, and a paged-out activity list
  returns to its first page.

- **What**: `Task.commentCount` is not used; the count shown is the
  connection's `totalCount`.
- **Why**: both count top-level comments, and the connection is already
  loaded.
- **Right fix**: none needed. A count that included replies would be worth
  showing on the task card, and needs a backend field.
- **Impact**: none.

## Phase 11 — Notifications & Realtime

- **What**: the socket layer has only ever run against a stand-in server.
- **Why**: no browser and no running backend were available to the agent.
  `shared/tests/realtime.ts` speaks the `graphql-ws` protocol to the real
  client, so the link, reconnection and every reconciler are exercised — but
  the far end is ours.
- **Right fix**: run the two together and try the cases the tests model: a
  dropped line, a token that expires while the socket is open, a refused
  subscription, sign-out. Then a `graphql-ws` case in the Phase 14 browser
  suite.
- **Impact**: a difference between the stand-in and the real server would show
  up only then. Realtime failing leaves every screen working, so the risk is
  stale screens, not broken ones.

- **What**: after a reload, starting the socket costs a session refresh.
- **Why**: the socket authenticates with a token in `connectionParams`, the
  token is kept in memory only, and a reload empties memory; the HTTP side
  carries on with its cookies and never needs it. The only way to a token is
  `refreshToken`.
- **Right fix**: let the API authenticate a socket from the same HTTP-only
  cookies (they are sent with the upgrade request on the same site), and drop
  the in-memory token altogether.
- **Impact**: every page load rotates the refresh token once. A load in two
  tabs at the same moment makes two rotations; the second presents a token the
  first has just replaced, which the backend's reuse detection may answer by
  revoking the session. Worth checking against the real backend.

- **What**: only five kinds of change are announced, so most of what other
  people do still arrives with the next fetch.
- **Why**: the API publishes `taskUpdated` for a task's details, status,
  assignee, estimate and sprint; `sprintUpdated` for a change of state;
  `commentAdded` for a new comment. It publishes nothing for a task created or
  deleted, a label, a dependency, logged time, a watcher, an edited or deleted
  comment, an attachment, a sprint's details or tasks, an epic or a milestone.
- **Right fix**: publish those on the backend. The client side is one more
  reconciler each.
- **Impact**: a card someone else creates does not appear on an open board,
  and one they delete does not leave it, until the board is fetched again.

- **What**: a notification arriving is announced with a toast as well as
  counted.
- **Why**: a badge changing from 2 to 3 is easy to miss and is not announced
  to a screen reader; a toast is both seen and spoken.
- **Right fix**: none needed, unless it proves noisy — then a setting.
- **Impact**: a burst of mentions is a burst of toasts.

- **What**: a notification's title and body are shown as the server wrote
  them, in English.
- **Why**: they are the server's sentences ("You were assigned “Build
  login”."), not codes this app could translate. The kind of notification is
  named from this app's strings.
- **Right fix**: have the API send a type and its parameters only, and compose
  the sentence here.
- **Impact**: none while the app ships `en` only. A second locale would show
  translated labels around untranslated sentences.

- **What**: a notification leads somewhere only for a task or a comment.
- **Why**: those are the two the backend records today, with the project (and
  for a comment, the task) in `metadata`. The four other kinds are defined but
  never sent, so where they should lead is not known.
- **Right fix**: add each to `notificationTarget` as the backend starts
  sending it.
- **Impact**: none today. A new kind would be listed without a link.

- **What**: the unread count is corrected by hand when a notification is read
  or arrives.
- **Why**: `markNotificationRead` returns the notification, not the new count,
  and an event carries no count.
- **Right fix**: none needed. "Mark all as read" and the catch-up after a gap
  both re-read it.
- **Impact**: a notification read in another tab leaves this tab's count one
  too high until the next re-read.

- **What**: after a gap in the connection every query on screen is re-read,
  which returns a paged list to its first page.
- **Why**: the server keeps no backlog, so there is no way to ask what was
  missed. Re-reading is the only honest way to be current.
- **Right fix**: a sequence number on events and a "since" argument, on the
  backend.
- **Impact**: someone three pages into a list when their wifi blinks is back
  on page one. A restart the client makes itself, to present a new token, is
  not treated as a gap.

- **What**: the connection badge explains itself only on hover (a `title`).
- **Why**: Avero's `Tooltip` was not reached for, and nothing has been seen
  to judge how much room the top bar has.
- **Right fix**: after a visual pass, a tooltip or a popover that says what
  "Offline" means for the reader, reachable by keyboard and touch.
- **Impact**: someone on a phone sees "Offline" with no explanation that the
  app still works.

- **What**: ~~`modules/ai` holds a fragment, a subscription and a hook, and no
  screen~~ — RESOLVED in Phase 12, which built the queue and the panels.
- **Why**: Phase 11 wired all five subscriptions; the AI queue was Phase 12.
- **Right fix**: done.
- **Impact**: none.

- **What**: Phase 3's placeholder `notification.operations.ts` was replaced
  rather than extended.
- **Why**: it selected six fields for the cache-policy tests; the feed needs
  eleven and a fragment. `unreadOnly` stays optional so those tests are
  unchanged; the feed always sends it.
- **Right fix**: none needed.
- **Impact**: none.

## Phase 12 — AI Recommendations & Approval

- **What**: a task or a sprint shows only the suggestions asked for during
  this visit. Earlier ones are on the project's AI tab.
- **Why**: `Project.aiRecommendations` filters by kind and by decision, not by
  task or sprint, and there is no `Task.aiRecommendations`.
- **Right fix**: a `taskId` / `sprintId` filter on the project's list, or a
  field on `Task` and `Sprint`.
- **Impact**: reopening a task does not show the estimate someone asked for
  yesterday; they have to look for it in the queue, where a card names its
  task only as a link ("Open the task").

- **What**: a recommendation names its task or sprint only as a link, never
  by title.
- **Why**: `AiRecommendation` carries `taskId` and `sprintId` and no relation
  to either.
- **Right fix**: `task { id title }` and `sprint { id name }` on the type.
- **Impact**: in the queue, two estimates for different tasks look alike until
  one is opened.

- **What**: an applied decision is followed by a second request, for the
  task's estimate and assignee.
- **Why**: approving or overriding changes the task, but the mutation returns
  the recommendation only and the backend publishes no `taskUpdated` for it.
- **Right fix**: return the task from the decision (or publish the event).
- **Impact**: one extra request per applied decision. If it fails, the
  decision still stands and the task on screen is stale until re-read; that
  failure is deliberately not shown as the decision's.

- **What**: someone else's new suggestion does not appear until the queue is
  next fetched.
- **Why**: the API announces decisions (`aiRecommendationUpdated`) and not
  requests.
- **Right fix**: publish the event when a recommendation is created.
- **Impact**: two admins reviewing the queue see each other's decisions at
  once, and each other's requests after a reload.

- **What**: after a decision the queue is re-read, which returns it to its
  first page.
- **Why**: a decided recommendation may no longer belong in the list on
  screen (a "Pending" filter), and which lists it belongs in is the server's
  to say — so the cached lists are dropped.
- **Right fix**: take the row out of the lists whose filter it no longer
  matches, as the notification feed does for "unread".
- **Impact**: someone deciding their way down a long queue is returned to the
  top after each decision. The rows stay on screen while it re-reads.

- **What**: an override always names a value. Unassigning a task through an
  override is not offered, though the API accepts a null assignee.
- **Why**: "use my own value" with no value is a rejection in all but name,
  and the form would need a way to say "nobody" that is not just an empty
  field.
- **Right fix**: none needed; reject the suggestion and unassign on the task.
- **Impact**: none through the UI.

- **What**: approving a suggestion that names nobody, or carries no number,
  unassigns the task or clears its estimate.
- **Why**: that is what the backend does with a null suggestion. The dialog
  says so before it is confirmed.
- **Right fix**: on the backend, refuse to approve a suggestion with nothing
  in it.
- **Impact**: none unseen; the consequence is spelled out.

- **What**: a suggested assignee who is not among the project's loaded members
  is described ("someone who is not listed on this project"), not named.
- **Why**: the suggestion carries an id, and candidates come from the
  project's teams, whose members need not be project members; the id is never
  shown.
- **Right fix**: `suggestedAssignee { id name }` on the recommendation.
- **Impact**: an admin may be asked to approve assigning a task to someone the
  card cannot name. The candidates table on the task page does name them.

- **What**: the wait for a suggestion is said to take "several seconds",
  without a figure.
- **Why**: the provider's timeout is the backend's setting (8s by default,
  tried twice), and the client is not told it.
- **Right fix**: none needed.
- **Impact**: none.

- **What**: `RECOMMENDATION` is offered as a filter and handled as an insight,
  though nothing creates one.
- **Why**: it is in the API's enum; the backend's four request mutations make
  the other four kinds.
- **Right fix**: none needed until the backend makes one.
- **Impact**: a filter option that always finds nothing.

## Phase 13 — Analytics

- **What**: another person's analytics are asked for only when the viewer
  presses "Show analytics", and a refusal is explained in the card.
- **Why**: the server shows them to the person themselves and to
  administrators of an organisation that person belongs to. The API does not
  say whether the viewer is one, and a refused request is logged by the
  backend as a security event — so asking on sight would log one for nearly
  every profile opened.
- **Right fix**: a field that states it (e.g. `User.viewerCanSeeAnalytics`),
  then show the figures on sight where it is true and no card where it is not.
- **Impact**: an administrator presses a button to see figures they are
  entitled to; anyone else can press it and is told why nothing is shown.

- **What**: the Analytics tab is not offered to a team lead who is a plain
  member of the project, though `rbac.md` gives `TEAM_LEAD` `analytics:view`.
- **Why**: it matches the server. `projectAnalytics` authorizes against the
  project, and role resolution at project scope reads the project and
  organisation memberships only — a team role is found only when a team is
  named. So such a team lead is refused; the project frame's roles leave team
  roles out for the same reason.
- **Right fix**: a backend decision — either resolve the viewer's team roles
  within the project for this check, or take `analytics:view` off `TEAM_LEAD`
  in the matrix.
- **Impact**: none through the UI: the hint and the server agree. The matrix
  in `rbac.md` promises something the API does not do.

- **What**: "Save the live figures" exists on the viewer's own card only.
- **Why**: `recomputeUserStatistics` takes any `userId`, but the server
  authorizes it for the owner or for a role on a placeholder organisation
  nobody belongs to — in effect, the owner alone.
- **Right fix**: on the backend, check `analytics:view` against the person's
  real organisations, as `userAnalytics` does; then offer the action to
  administrators too.
- **Impact**: an administrator cannot bring someone else's saved figures up
  to date.

- **What**: the saved figures are shown, but nothing else in this client
  reads them.
- **Why**: `User.statistics` is a cache that only `recomputeUserStatistics`
  writes, and every other screen uses the live figures.
- **Right fix**: on the backend, refresh the copy from task events (its own
  known-debt), or drop it in favour of the live figures.
- **Impact**: saving changes one column on the user's own profile and nothing
  else they can see. The card says what the saved copy is.

- **What**: the trend chart has never been drawn, and two sprints with the
  same name share a row key in its data table.
- **Why**: as with the burndown — the test DOM has no size. The chart's x
  axis and its table are keyed by the sprint's name, which the API does not
  require to be unique.
- **Right fix**: a look in a browser; and a category key separate from the
  label in `@averoui/charts`.
- **Impact**: axis labels may crowd in a project of many sprints. Duplicate
  names would draw as one category and log a React key warning.

- **What**: a team velocity of 0 reads the same whether no sprint has been
  completed or completed sprints delivered nothing.
- **Why**: the API returns 0 for both.
- **Right fix**: a nullable `teamVelocity` on the backend, or the count of
  completed sprints beside it.
- **Impact**: a new project shows "0 points per sprint". The line under the
  figure says what it averages.

- **What**: the figures follow other people's work only as far as the socket
  announces it.
- **Why**: the page re-reads on `taskUpdated` and `sprintUpdated`; a task
  created or deleted is announced by neither (Phase 11).
- **Right fix**: as Phase 11 — publish those events.
- **Impact**: a count can lag until the tab is opened again, which always
  re-reads.

- **What**: `formatElapsed` (analytics) and `formatDuration` (task) both write
  a number of seconds as text.
- **Why**: logged time is hours and minutes; a task's time to completion runs
  to days, which the first does not write.
- **Right fix**: one formatter in `shared/utils` taking the largest unit to
  use, if a third caller appears.
- **Impact**: two small functions to keep in step.

## Phase 14 — Hardening, A11y, Perf & Release

Several earlier entries said "never seen in a browser". Phase 14 ran the app
against the real backend in a real browser, so these are now settled: the
shell at 360px, the burndown and trend charts, dragging a card with a mouse,
the socket against the real server, two tabs loading at once, and two windows
updating each other. What each showed is in `CLIENT_PLAN.md`, Phase 14.

- **What**: color contrast fails wherever Avero paints one of six pairs, and
  the accessibility audit cannot pass until it stops.
- **Why**: they are Avero's own colors, not this app's:

  | Text on background | Ratio | Where |
  |---|---|---|
  | white on amber `#fe9a00` | 2.13:1 | filled buttons, the current tab, the current sidebar item |
  | gray-500 on the page background `#f4f4f4` | 4.39:1 | subtle links, field hints and ghost buttons that sit on the page rather than on a card |
  | gray-400 on white | 2.6:1 | `EmptyState`, `circle` and `text` variants |
  | gray-300 on white | 1.47:1 | `EmptyState`, `icon` variant — close to invisible |
  | gray-300 on `#f9fafc` | 1.4:1 | the same, inside a board column |
  | amber-700 on the brand tint | 3.01:1 | `Chip` (a task's labels) |

- **Right fix**: in Avero — a foreground token for the brand color (R11);
  empty-state text at gray-500 or darker; a page background light enough for
  gray-500 (gray-50 gives 4.63:1), or gray-600 for text on it. Locally, the
  second and third could be forced in `global.css` by overriding two tokens,
  if the owner would rather not wait.
- **Impact**: WCAG 1.4.3 fails on every screen. `e2e/sweep.e2e.ts` lists the
  six pairs as known and fails on any other; remove a pair from that list as
  Avero fixes it.

- **What**: on a phone, a table that scrolls sideways cannot be scrolled with
  the keyboard.
- **Why**: Avero's `table-container` is a scroller with no `tabindex`.
- **Right fix**: `tabindex="0"` and a label on the container, in Avero.
- **Impact**: a keyboard user on a narrow screen cannot reach a table's last
  columns. Also in the sweep's known list.

- **What**: `global.css` makes every `.overflow-x-auto` element
  `position: relative`.
- **Why**: a screen-reader-only label is absolutely positioned. Inside a
  scroller that is not its containing block it escapes the clipping and
  widens the whole page — which six screens did, by up to 1,400px. Avero's
  table container is such a scroller, so the fix could not be made per
  component.
- **Right fix**: `relative` on Avero's `table-container`; the rule here then
  covers only this app's own scrollers.
- **Impact**: none known. It sits in the `base` layer, so a positioning
  utility on the same element still wins.

- **What**: a full end-to-end run takes about nine minutes, most of it
  waiting.
- **Why**: the API allows 300 requests a minute from one address, hard-coded,
  and the suite would pass that several times over. `e2e/support/pace.ts`
  counts every request and waits out the minute.
- **Right fix**: make the limit configurable on the backend
  (`RATE_LIMIT_MAX`) and raise it for a test database. The pacing then never
  triggers and can stay as a guard.
- **Impact**: slow feedback, and a CI job to match.

- **What**: the end-to-end suite writes to whatever database the backend is
  pointed at, and leaves its data there.
- **Why**: it runs against the real API, which has no "delete user".
- **Right fix**: a database of its own for the suite (the CI template uses
  one), or a clean-up by email domain, as the backend's tests do.
- **Impact**: every full local run adds some thirty accounts under
  `@e2e.optitask.test`, and their organisations, to the developer's database.

- **What**: a signed-out visitor's page load makes three requests to learn
  it is signed out: `me`, then two refresh attempts.
- **Why**: the Apollo link answers `UNAUTHENTICATED` with a refresh, and the
  session bootstrap then tries one of its own.
- **Right fix**: have the bootstrap rely on the link's refresh, or skip its
  own when the link has just failed one.
- **Impact**: one wasted request on every signed-out load. Harmless.

- **What**: the first paint of a signed-out page waits on a chain of three
  downloads: the entry script, then the app, then the page.
- **Why**: `main.tsx` imports the app dynamically so a bad configuration can
  be reported instead of leaving a blank window.
- **Right fix**: preload the app chunk from `index.html` (a build plugin), if
  the mobile figure matters.
- **Impact**: largest contentful paint is 3.4s on Lighthouse's simulated slow
  4G, 0.7s on desktop settings. A placeholder is painted from the HTML in the
  meantime.

- **What**: Lighthouse was run on the sign-in screen only, on this machine.
- **Why**: it cannot sign in by itself, and no deployment exists to measure.
- **Right fix**: a Lighthouse run with a signed-in session (a script that
  sets the cookies first) against a staging deployment.
- **Impact**: the signed-in screens, which are heavier, have no score.

- **What**: the CI workflow has never run.
- **Why**: switching CI on is the repository owner's call, so it ships as a
  template. Every command in it has been run by hand.
- **Right fix**: copy it to `.github/workflows/` and fix whatever the first
  run turns up — most likely the browser job's start-up.
- **Impact**: none until it is switched on.

- **What**: no one has listened to the app with a screen reader, and the
  keyboard tests cover six flows, not every one.
- **Why**: a screen-reader pass needs a person; the announcements are
  asserted as text in live regions, which is not the same as hearing them.
- **Right fix**: a pass with NVDA and VoiceOver over sign-in, the board, a
  task and the AI approval; keyboard tests for the task page's forms.
- **Impact**: an awkward or repeated announcement would not be noticed.

- **What**: the favicon is a placeholder — an amber square with a ring.
- **Why**: there was none, and the missing file was an error in every
  console. The project has no logo yet.
- **Right fix**: the real mark, in `public/favicon.svg`.
- **Impact**: none.

- **What**: the backend's production dependencies carry eight advisories, one
  critical (`proxy-addr`, through Express 4, IP spoofing behind a trusted
  proxy).
- **Why**: found by `pnpm audit --prod` during the client's security review.
  None is in the frontend's own production tree.
- **Right fix**: on the backend — the Apollo Server 5 and Express 5 upgrade
  already in its known-debt removes most of them.
- **Impact**: the backend's to weigh before release; listed here so it is not
  lost.

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
