import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.typeDefs.ts', // SDL strings, no logic
        'src/server.ts', // bootstrap (process/port/WS wiring)
        'src/**/index.ts', // re-export barrels
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        statements: 80,
        branches: 72,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL('./src/', import.meta.url)),
      },
      {
        // Mirrors the tsconfig path: "@contracts" is not a resolvable package
        // name for Node, so it is mapped explicitly rather than via node_modules.
        find: /^@contracts$/,
        replacement: fileURLToPath(
          new URL('../../packages/contracts/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
});
