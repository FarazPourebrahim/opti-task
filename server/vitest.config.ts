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
        'src/**/*.schema.ts', // SDL strings, no logic
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
    alias: {
      '@modules': fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
});