import type { ASTNode, ValidationContext, ValidationRule } from 'graphql';
import { Kind } from 'graphql';
import { GraphQLError } from 'graphql';

/**
 * A query-depth-limiting validation rule (DoS guard against deeply nested or
 * cyclic-via-fragments queries). Counts the deepest field nesting in each
 * operation — resolving fragment spreads, with a cycle guard — and rejects any
 * operation exceeding `maxDepth`. Cheaper and simpler than full cost analysis;
 * see docs/security.md.
 */
export function depthLimit(maxDepth: number): ValidationRule {
  return (context: ValidationContext) => {
    const document = context.getDocument();
    const fragments = new Map<string, ASTNode>();
    for (const definition of document.definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        fragments.set(definition.name.value, definition);
      }
    }

    function nodeDepth(node: ASTNode, seenFragments: Set<string>): number {
      switch (node.kind) {
        case Kind.OPERATION_DEFINITION:
        case Kind.INLINE_FRAGMENT:
        case Kind.FRAGMENT_DEFINITION: {
          const selections = node.selectionSet?.selections ?? [];
          return Math.max(0, ...selections.map((s) => nodeDepth(s, seenFragments)));
        }
        case Kind.FIELD: {
          const selections = node.selectionSet?.selections ?? [];
          if (selections.length === 0) {
            return 1;
          }
          return 1 + Math.max(0, ...selections.map((s) => nodeDepth(s, seenFragments)));
        }
        case Kind.FRAGMENT_SPREAD: {
          const name = node.name.value;
          if (seenFragments.has(name)) {
            return 0; // cycle guard
          }
          const fragment = fragments.get(name);
          if (!fragment) {
            return 0;
          }
          return nodeDepth(fragment, new Set(seenFragments).add(name));
        }
        default:
          return 0;
      }
    }

    return {
      OperationDefinition(operation) {
        const depth = nodeDepth(operation, new Set());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Query exceeds maximum depth of ${maxDepth} (got ${depth}).`,
              { nodes: [operation] },
            ),
          );
        }
      },
    };
  };
}
