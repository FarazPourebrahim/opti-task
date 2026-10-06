import { fileURLToPath } from 'node:url';
// `vitest/config` re-exports Vite's `defineConfig` widened with the `test`
// block, so one config can drive the dev server, the build and the test run.
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

/**
 * One config drives the dev server, the production build AND vitest, so the
 * `@contracts` alias can never drift between them. `@contracts` is not a valid
 * Node package specifier (see CLIENT_PLAN.md risk R7), so it resolves only
 * because it is mapped here and in `tsconfig.json` — both must stay in sync.
 */
const srcPath = fileURLToPath(new URL('./src/', import.meta.url));
const contractsPath = fileURLToPath(
  new URL('../../packages/contracts/src/index.ts', import.meta.url),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: srcPath },
      { find: /^@contracts$/, replacement: contractsPath },
    ],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    // Written beside the bundle for an error tracker to read, but not pointed
    // at from it: the browser never asks for them, and the host should not
    // serve them (see docs/deployment.md).
    sourcemap: 'hidden',
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/shared/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Route-level tests load lazy chunks and drive several steps; the 5s
    // default leaves no room for that under a parallel run.
    testTimeout: 20_000,
    /*
     * The test DOM performs no layout and computes no styles, so running the
     * Tailwind pipeline here would buy nothing — `vite build` is what compiles
     * and validates the stylesheet.
     */
    css: false,
    // The env loader fails fast on missing config, so tests need a valid pair.
    env: {
      VITE_API_URL: 'http://localhost:4000/graphql',
      VITE_WS_URL: 'ws://localhost:4000/graphql',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx', // bootstrap (DOM mount only)
        'src/**/index.ts', // re-export barrels
        'src/shared/tests/**', // the harness itself
        'src/shared/graphql/generated/**', // codegen output, not ours to test
      ],
      /*
       * Floors, a little under what the suite reaches (97.4 / 87.9 / 93.3 /
       * 97.4 when they were set, generated code left out), so a change that leaves new code untested
       * fails the run. Raise them as coverage rises; never lower them to pass.
       */
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 90,
        lines: 95,
      },
    },
  },
});
