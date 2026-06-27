import { healthResolvers, healthTypeDefs } from './health.js';

/**
 * Composed GraphQL schema. As modules land, their typeDefs/resolvers are added
 * to these arrays (Phase 2 introduces formal schema stitching + DataLoaders).
 */
export const typeDefs = [healthTypeDefs];

export const resolvers = [healthResolvers];
