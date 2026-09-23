#!/usr/bin/env node
/**
 * Fails if any generated GraphQL document nests deeper than the API allows.
 *
 * The backend caps query depth at 12 as a DoS guard, and rejects anything
 * deeper with a validation error at runtime. Catching it here turns a
 * production failure into a build failure.
 *
 * Depth is measured the same way the server's rule does: each nested selection
 * set counts one level. Fragment spreads are resolved so a document split
 * across fragments is measured as the server sees it, flattened.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'graphql';

const MAX_DEPTH = 12;
const ROOT = join(process.cwd(), 'src');

function collectOperationFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectOperationFiles(full));
    } else if (
      entry.endsWith('.operations.ts') ||
      entry.endsWith('.fragments.ts')
    ) {
      found.push(full);
    }
  }
  return found;
}

/** Pulls each `graphql(\`…\`)` template out of a source file. */
function extractDocuments(source) {
  const documents = [];
  const pattern = /graphql\(\s*`([\s\S]*?)`\s*\)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) documents.push(match[1]);
  }
  return documents;
}

function depthOfSelectionSet(selectionSet, fragments, seen) {
  if (!selectionSet) return 0;

  let deepest = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === 'FragmentSpread') {
      const name = selection.name.value;
      // A cyclic spread is invalid GraphQL; guard so this never hangs.
      if (seen.has(name)) continue;
      const fragment = fragments.get(name);
      if (!fragment) continue;
      seen.add(name);
      deepest = Math.max(
        deepest,
        depthOfSelectionSet(fragment.selectionSet, fragments, seen),
      );
      seen.delete(name);
      continue;
    }

    // An inline fragment adds no depth of its own.
    const child = depthOfSelectionSet(selection.selectionSet, fragments, seen);
    const own = selection.kind === 'InlineFragment' ? child : child + 1;
    deepest = Math.max(deepest, own);
  }

  return deepest;
}

function main() {
  const files = collectOperationFiles(ROOT);
  const violations = [];
  let checked = 0;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const text of extractDocuments(source)) {
      let document;
      try {
        document = parse(text);
      } catch (error) {
        violations.push(
          `${file}: document failed to parse — ${error.message}`,
        );
        continue;
      }

      const fragments = new Map(
        document.definitions
          .filter((def) => def.kind === 'FragmentDefinition')
          .map((def) => [def.name.value, def]),
      );

      for (const definition of document.definitions) {
        if (definition.kind !== 'OperationDefinition') continue;
        checked += 1;

        const depth = depthOfSelectionSet(
          definition.selectionSet,
          fragments,
          new Set(),
        );

        if (depth > MAX_DEPTH) {
          violations.push(
            `${file}: operation "${definition.name?.value ?? 'anonymous'}" ` +
              `is ${depth} levels deep (the API rejects anything over ${MAX_DEPTH})`,
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('Query depth check failed:\n');
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }

  console.log(
    `Query depth OK: ${checked} operation(s) in ${files.length} file(s), max allowed ${MAX_DEPTH}.`,
  );
}

main();
