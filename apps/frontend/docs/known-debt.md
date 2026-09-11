# Known Technical Debt / Intentional Shortcuts — Frontend

Each entry: what, why, what the "right" fix looks like, and impact if left
unfixed. Mirrors `apps/backend/docs/known-debt.md`.

---

## Phase 0 — Foundations

- **What**: `App.tsx` renders a hard-coded placeholder with two untranslated
  string literals, which the Global DoD otherwise forbids.
- **Why**: i18n is wired in Phase 1 (F1.11) and the router + real shell land in
  Phase 5 (F5.2). A scaffold needs *something* to mount and assert against.
- **Right fix**: Phase 5 replaces the whole file with the route tree; the
  placeholder copy disappears rather than being translated.
- **Impact**: none — the strings are never user-visible outside a dev scaffold.
  If Phase 5 lands and this text still exists, that is a bug.

- **What**: `renderWithProviders` wraps children in an empty fragment.
- **Why**: no providers exist yet. Theme + i18n arrive in Phase 1, toasts in
  Phase 2, Apollo in Phase 3, auth in Phase 4, router in Phase 5.
- **Right fix**: each phase adds its provider to `AllProviders` so every
  existing test picks it up in one edit.
- **Impact**: none. The seam exists precisely so this stays a one-line change.

- **What**: accessibility assertions use `jest-axe` rather than `vitest-axe`.
- **Why**: `vitest-axe` is still a pre-release; `jest-axe` is a stable wrapper
  around the same `axe-core` engine and works under Vitest via
  `expect.extend(toHaveNoViolations)`.
- **Right fix**: swap to `vitest-axe` once it reaches a stable release, or drop
  both and call `axe-core` directly with a local matcher.
- **Impact**: none functionally — the audit engine is identical. Cosmetic
  dependency-naming mismatch only.

## Phase 1 — Design System & Theming

- **What**: `resets.css` reverses the working agreement's ordering of
  `min-block-size: 100dvh` / `100vh` on `body`.
- **Why**: the agreement lists `dvh` first. Later declarations win, so that
  ordering makes `100vh` the effective value everywhere and leaves `dvh` as dead
  code — reintroducing the exact mobile viewport bug `dvh` exists to fix.
- **Right fix**: correct the snippet in `.claude/CLAUDE.md` so future projects
  do not inherit it.
- **Impact**: none here — this app is correct. The shared agreement is not.

- **What**: the theme is applied twice — once by an inline script in
  `index.html` and once by `ThemeProvider` — and the storage key plus class
  names are duplicated between them.
- **Why**: the class must be on `<body>` before first paint. Anything importable
  runs after the module bundle loads, which is one repaint too late; that flash
  is precisely what the script prevents.
- **Right fix**: none available while the theme is a `body` class and the app is
  a client-rendered SPA. Server rendering would let the class be emitted in the
  HTML directly.
- **Impact**: changing `THEME_STORAGE_KEY` or the class names means editing two
  files. `theme.test.tsx` asserts they agree, so drift fails the suite.

- **What**: `css: false` in the Vitest config — component stylesheets are not
  processed during tests.
- **Why**: jsdom's CSS parser predates native nesting and dumped every nested
  stylesheet to stderr as a parse error, burying real failures. jsdom performs
  no layout, so no assertion depended on the CSS.
- **Right fix**: none needed. `vite build` compiles and validates every
  stylesheet (nesting is flattened to descendant selectors there), and
  `tokens.test.ts` reads the CSS as text for its invariants.
- **Impact**: a malformed `.module.css` surfaces at build time rather than test
  time. CSS Modules still resolve to proxied class names in tests.

- **What**: routing in `App.tsx` is a `window.location.hash` comparison.
- **Why**: React Router lands in Phase 5 (F5.1); the token gallery needed to be
  reachable in Phase 1 without pulling that dependency forward.
- **Right fix**: Phase 5 replaces the whole file with the data router.
- **Impact**: the hash is read once at render and is not reactive — navigating
  to `#/dev/tokens` needs a reload. Dev-only; the branch is statically removed
  from production builds.

## Phase 2 — Shared Component Library

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

- **What**: `Components.page.tsx` uses literal strings; `Tokens.page.tsx` uses
  i18n keys, and a few `dev.*` keys therefore ship inside `en.json`.
- **Why**: dev-only pages are never localized, so putting their copy through
  i18n adds catalogue entries nobody will translate. The tokens gallery predates
  that decision.
- **Right fix**: drop the `dev.*` keys from `en.json` and inline the strings in
  `Tokens.page.tsx`, so dev pages are consistently exempt.
- **Impact**: a few hundred bytes of dev-only copy in the production
  translation catalogue. No dev *code* ships — verified by grepping the built
  bundle for gallery identifiers.

- **What**: `--color-border-400` is asserted at 3:1 against a control's own
  fill (`--color-surface-500`), not against the page behind it.
- **Why**: requiring both forced a mid-grey hairline on every field, which is
  what made inputs read as unstyled browser controls. WCAG 1.4.11 asks that a
  component be *identifiable*; its boundary against its own fill is what does
  that, and elevation (`--shadow-100`) now carries the separation from the page.
- **Right fix**: none if the reading holds. If a stricter interpretation is
  wanted, give controls a fill that clears 3:1 against the page instead of
  darkening the border again.
- **Impact**: against the page a light-theme control border sits at 2.75:1.
  Re-check during the Phase 14 accessibility sweep.

- **What**: no visual verification of any component.
- **Why**: the suite asserts structure, behaviour, keyboard paths and axe
  cleanliness, but happy-dom performs no layout — nothing here proves a
  component *looks* right, or that it holds up at 360px.
- **Right fix**: open `#/dev/components` and `#/dev/tokens` in a browser at
  narrow and wide widths; Phase 14 adds the Lighthouse and responsive passes.
- **Impact**: spacing, overflow and contrast-in-context bugs would not be
  caught by CI today. This is the single largest gap in Phase 2's coverage.

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

- **What**: the auth pages take `onSignedIn` / `onGoToLogin` callbacks instead
  of navigating.
- **Why**: React Router lands in Phase 5. Wiring `window.location` here would
  be replaced immediately and would make the pages untestable in isolation.
- **Right fix**: Phase 5 passes real navigation into these props, or replaces
  them with router hooks.
- **Impact**: nothing routes yet — the pages are reachable only from tests and,
  after Phase 5, from the router.

- **What**: `requestPasswordReset` is wired in `auth.operations.ts` but no
  screen calls it, and `ForgotPassword.page.tsx` offers no email field.
- **Why**: the backend mutation validates the address and returns success while
  issuing no token and sending no mail. A form that appears to work would leave
  users waiting for an email that never arrives.
- **Right fix**: when the backend grows a reset-token table, turn that page into
  a real form; the operation is already defined.
- **Impact**: users cannot self-serve a forgotten password. The screen says so.

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
