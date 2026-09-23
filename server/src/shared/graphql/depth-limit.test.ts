import { describe, expect, it } from 'vitest';
import {
  buildSchema as buildGraphQLSchema,
  getIntrospectionQuery,
  parse,
  validate,
} from 'graphql';
import { depthLimit } from './depth-limit.js';

/**
 * Unit test for the depth-limit validation rule. Uses a tiny self-referential
 * schema so we can build queries of arbitrary nesting depth.
 */
const schema = buildGraphQLSchema(`
  type Node { id: ID!, child: Node }
  type Query { root: Node }
`);

function depthErrors(query: string, maxDepth: number): readonly unknown[] {
  return validate(schema, parse(query), [depthLimit(maxDepth)]);
}

describe('depthLimit', () => {
  it('accepts a query within the limit', () => {
    const query = `{ root { child { id } } }`; // depth 3
    expect(depthErrors(query, 5)).toHaveLength(0);
  });

  it('rejects a query exceeding the limit', () => {
    const query = `{ root { child { child { child { id } } } } }`; // depth 5
    const errors = depthErrors(query, 3);
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain('maximum depth');
  });

  it('counts depth through fragment spreads', () => {
    const query = `
      { root { ...Deep } }
      fragment Deep on Node { child { child { id } } }
    `; // root -> child -> child -> id  => depth 4
    expect(depthErrors(query, 3)).toHaveLength(1);
    expect(depthErrors(query, 4)).toHaveLength(0);
  });

  it('exempts the standard introspection query (it nests deeper than the limit)', () => {
    // The introspection query tooling sends (Apollo Sandbox / playground) is
    // ~13 levels deep; without exempting `__`-prefixed meta-fields it would be
    // rejected at the production limit of 12, breaking schema loading.
    expect(depthErrors(getIntrospectionQuery(), 12)).toHaveLength(0);
  });
});
