import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { printSchema } from 'graphql';
import { buildSchema } from '@shared/graphql/schema';

/**
 * Emits the composed GraphQL SDL to docs/api/schema.graphql — the authoritative,
 * code-free schema reference for frontend/AI consumers. Run: `npm run schema:print`.
 */
const outPath = resolve(process.cwd(), 'docs/api/schema.graphql');
mkdirSync(dirname(outPath), { recursive: true });

const header = `# OptiTask GraphQL Schema (generated)
# Source of truth: composed from src/modules/**/*.schema.ts + src/shared/graphql/base.ts
# Regenerate with: npm run schema:print
`;

writeFileSync(outPath, `${header}\n${printSchema(buildSchema())}\n`, 'utf8');
process.stdout.write(`Wrote ${outPath}\n`);
