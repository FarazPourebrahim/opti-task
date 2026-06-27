import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { baseTypeDefs } from './base.js';
import { scalarResolvers } from './scalars.js';
import { healthResolvers, healthTypeDefs } from './health.js';
import { demoResolvers, demoTypeDefs } from './demo.js';
import { authTypeDefs } from '@modules/auth/auth.schema';
import { authResolvers } from '@modules/auth/auth.resolver';

/**
 * Composes the executable schema from the base scaffolding plus every module's
 * typeDefs/resolvers. New modules register by adding their pair to these arrays
 * — they extend the shared `Query`/`Mutation` roots declared in base.ts.
 */
const typeDefs = [baseTypeDefs, healthTypeDefs, demoTypeDefs, authTypeDefs];

const resolvers = [
  scalarResolvers,
  healthResolvers,
  demoResolvers,
  authResolvers,
];

export function buildSchema(): GraphQLSchema {
  return makeExecutableSchema({ typeDefs, resolvers });
}
