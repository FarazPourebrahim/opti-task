import { fileURLToPath } from 'node:url';
// `vitest/config` re-exports Vite's `defineConfig` widened with the `test`
// block, so one config can drive the dev server, the build and the test run.
import { loadEnv } from 'vite';
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

/** `https://api.example.com/graphql` → `https://api.example.com`. */
function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/**
 * The response headers a host should send with this app, as `vite preview`
 * sends them — so the end-to-end suite can run against the production build
 * under the same policy a deployment uses. `docs/deployment.md` explains each
 * directive; keep the two in step.
 */
function securityHeaders(env: Record<string, string>): Record<string, string> {
  const api = [originOf(env['VITE_API_URL']), originOf(env['VITE_WS_URL'])]
    .filter((origin): origin is string => origin !== null)
    .join(' ');

  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      // Radix and the charts position things with inline styles.
      "style-src 'self' 'unsafe-inline'",
      // Avatars and logos are addresses people paste in.
      "img-src 'self' data: https:",
      "font-src 'self'",
      `connect-src 'self' ${api}`.trim(),
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

export default defineConfig(({ mode }) => ({
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
  // The same port as the dev server: it is the origin the API's CORS allowlist
  // names by default.
  preview: {
    port: 5173,
    strictPort: true,
    headers: securityHeaders(loadEnv(mode, process.cwd(), 'VITE_')),
  },
  build: {
    outDir: 'dist',
    // Every asset is a file. Inlined as `data:` URIs, the small font subsets
    // would need `font-src data:` in the Content-Security-Policy, and would be
    // downloaded by everyone instead of only by those who need the glyphs.
    assetsInlineLimit: 0,
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
}));
