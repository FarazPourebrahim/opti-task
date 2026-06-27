/**
 * Health check — the only operation present in Phase 0. Domain typeDefs and
 * resolvers are merged into this base in later phases (see ROADMAP Phase 2).
 */
export const healthTypeDefs = /* GraphQL */ `
  type HealthStatus {
    status: String!
    uptimeSeconds: Float!
    timestamp: String!
  }

  type Query {
    health: HealthStatus!
  }
`;

export const healthResolvers = {
  Query: {
    health: () => ({
      status: 'ok',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  },
};
