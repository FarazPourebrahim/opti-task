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
