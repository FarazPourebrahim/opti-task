/**
 * Router setup and route tree.
 *
 * This file only ever maps paths to feature pages, applies guards and nests
 * layouts — no business logic, no data fetching. The router itself lands in
 * Phase 5 (F5.1); until then this renders the boot placeholder below.
 *
 * The strings here are intentionally the only un-translated copy in the app:
 * i18n is wired in Phase 1 (F1.11) and this placeholder is replaced by the
 * real shell in Phase 5. Tracked in docs/known-debt.md.
 */
export function App() {
  return (
    <main>
      <h1>OptiTask</h1>
      <p>Frontend scaffold is running.</p>
    </main>
  );
}
