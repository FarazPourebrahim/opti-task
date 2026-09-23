import {
  DateTimeResolver,
  UUIDResolver,
  JSONResolver,
} from 'graphql-scalars';

/**
 * Custom scalars shared across the schema. Declarations live in base.ts; this
 * maps each declared scalar to its (battle-tested) graphql-scalars resolver.
 */
export const scalarResolvers = {
  DateTime: DateTimeResolver,
  UUID: UUIDResolver,
  JSON: JSONResolver,
};
