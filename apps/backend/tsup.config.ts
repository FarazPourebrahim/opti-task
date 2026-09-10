import { defineConfig } from 'tsup';

/**
 * Production bundle for the backend.
 *
 * The app is bundled rather than emitted file-by-file because `@contracts` is a
 * workspace package: `tsc` type-checks against it but never emits it into
 * `dist/`, so a plain compile would ship a `dist/server.js` that cannot resolve
 * `@contracts` at runtime. `noExternal` inlines it into the output; every real
 * npm dependency (Prisma's generated client, argon2's native binding) stays
 * external and is resolved from node_modules as usual.
 */
export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  splitting: false,
  noExternal: ['@contracts'],
});
