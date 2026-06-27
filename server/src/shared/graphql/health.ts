/**
 * Health check. Uses `extend type Query` so it composes with every other
 * module's root fields (the base `Query`/`Mutation` live in base.ts).
 */
export const healthTypeDefs = /* GraphQL */ `
  type HealthStatus {
    status: String!
    uptimeSeconds: Float!
    timestamp: DateTime!
  }

  extend type Query {
    health: HealthStatus!
  }
`;

export const healthResolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      uptimeSeconds: process.uptime(),
      timestamp: new Date(),
    }),
  },
};
