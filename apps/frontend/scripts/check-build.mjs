#!/usr/bin/env node
/**
 * Checks the production build for what no type, lint or unit test can see.
 *
 * Run after `vite build`. It reads `dist/` and fails when:
 *
 * - the stylesheet is missing Avero's classes or the brand color. Tailwind
 *   only knows Avero's class names through the `@source` lines in
 *   `global.css`; if that path breaks, every component renders unstyled and
 *   nothing else notices;
 * - a script still imports the bare `@contracts` specifier, which no browser
 *   can resolve;
 * - a bundle points at its source map, or carries something shaped like a
 *   secret.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(process.cwd(), 'dist', 'assets');

/** One class from each Avero package the app styles through `@source`. */
const REQUIRED_CSS = [
  ['an Avero component class', '.bg-primary-hover'],
  ['an Avero component radius', '.rounded-3xl'],
  ['the brand color token', '--color-primary:'],
];

const FORBIDDEN_JS = [
  ['a bare @contracts import', /from\s*["']@contracts["']/],
  ['a source map reference', /\/\/# sourceMappingURL=/],
  ['a private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a database connection string', /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/],
  [
    'a server-side secret name',
    /\b(?:JWT_(?:ACCESS|REFRESH)_SECRET|DATABASE_URL)\b/,
  ],
];

const failures = [];

let files;
try {
  files = readdirSync(ASSETS);
} catch {
  console.error('No build found. Run `pnpm run build` first.');
  process.exit(1);
}

const css = files
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(join(ASSETS, file), 'utf8'))
  .join('\n');

for (const [what, needle] of REQUIRED_CSS) {
  if (!css.includes(needle)) {
    failures.push(`The stylesheet is missing ${what} (${needle}).`);
  }
}

for (const file of files.filter((name) => name.endsWith('.js'))) {
  const source = readFileSync(join(ASSETS, file), 'utf8');
  for (const [what, pattern] of FORBIDDEN_JS) {
    if (pattern.test(source)) failures.push(`${file} contains ${what}.`);
  }
}

if (failures.length > 0) {
  console.error(`Build check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Build OK: ${files.filter((name) => name.endsWith('.js')).length} script(s) and the stylesheet checked.`,
);
