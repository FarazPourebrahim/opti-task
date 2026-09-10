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
