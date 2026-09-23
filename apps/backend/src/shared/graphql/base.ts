/**
 * Root schema scaffolding. Declares custom scalars, the shared pagination
 * `PageInfo`/`SortDirection` types, and base `Query`/`Mutation` roots that every
 * feature extends via `extend type Query` / `extend type Mutation`.
 */
export const baseTypeDefs = /* GraphQL */ `
  scalar DateTime
  scalar UUID
  scalar JSON

  enum SortDirection {
    ASC
    DESC
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type Query {
    _empty: Boolean
  }

  type Mutation {
    _empty: Boolean
  }
`;
