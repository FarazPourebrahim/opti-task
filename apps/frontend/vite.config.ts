import { fileURLToPath } from 'node:url';
// `vitest/config` re-exports Vite's `defineConfig` widened with the `test`
// block, so one config can drive the dev server, the build and the test run.
import { defineConfig } from 'vitest/config';
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
  plugins: [react()],
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
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/shared/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    /*
     * jsdom's CSS parser predates native nesting and dumps every nested
     * stylesheet to stderr as a parse error, burying real failures. It cannot
     * lay out or compute styles either, so processing CSS here buys nothing —
     * `vite build` is what validates the stylesheets. CSS Modules still resolve
     * to proxied class names, so class-based queries keep working.
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
      ],
    },
  },
});
