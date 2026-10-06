import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests: the built client in a real browser against the REAL
 * backend — no mocks. They are what certifies what the component suite cannot
 * see: layout, the drag library, the socket and the cookies.
 *
 * They need a reachable PostgreSQL with the backend's migrations applied (the
 * backend's own `.env`), and they write to that database: every run registers
 * its own users under `@e2e.optitask.test` and builds its own organisation.
 *
 * The installed Chrome is used rather than a downloaded browser; set
 * `E2E_BROWSER_CHANNEL` to `msedge`, or to an empty string for Playwright's
 * bundled Chromium (as a CI runner would).
 */
const channel = process.env['E2E_BROWSER_CHANNEL'] ?? 'chrome';

/*
 * `E2E_TARGET=build` runs the suite against the production build, served with
 * the deployment's security headers, instead of the dev server.
 */
const serveClient =
  process.env['E2E_TARGET'] === 'build'
    ? 'pnpm run build && pnpm run preview'
    : 'pnpm run dev';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // One database behind every test, and a rate limiter per IP in front of it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: './e2e/.results',
  use: {
    baseURL: 'http://localhost:5173',
    ...(channel ? { channel } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter optitask-backend run dev',
      url: 'http://localhost:4000/readyz',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: serveClient,
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
