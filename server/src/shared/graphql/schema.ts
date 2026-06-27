import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { baseTypeDefs } from './base.js';
import { scalarResolvers } from './scalars.js';
import { healthResolvers, healthTypeDefs } from './health.js';
import { authTypeDefs } from '@modules/auth/auth.schema';
import { authResolvers } from '@modules/auth/auth.resolver';
import { userTypeDefs } from '@modules/user/user.schema';
import { userResolvers } from '@modules/user/user.resolver';
import { organizationTypeDefs } from '@modules/organization/organization.schema';
import { organizationResolvers } from '@modules/organization/organization.resolver';
import { projectTypeDefs } from '@modules/project/project.schema';
import { projectResolvers } from '@modules/project/project.resolver';
import { teamTypeDefs } from '@modules/team/team.schema';
import { teamResolvers } from '@modules/team/team.resolver';

/**
 * Composes the executable schema from the base scaffolding plus every module's
 * typeDefs/resolvers. New modules register by adding their pair to these arrays
 * — they extend the shared `Query`/`Mutation` roots declared in base.ts.
 */
const typeDefs = [
  baseTypeDefs,
  healthTypeDefs,
  authTypeDefs,
  userTypeDefs,
  organizationTypeDefs,
  projectTypeDefs,
  teamTypeDefs,
];

const resolvers = [
  scalarResolvers,
  healthResolvers,
  authResolvers,
  userResolvers,
  organizationResolvers,
  projectResolvers,
  teamResolvers,
];

export function buildSchema(): GraphQLSchema {
  return makeExecutableSchema({ typeDefs, resolvers });
}
