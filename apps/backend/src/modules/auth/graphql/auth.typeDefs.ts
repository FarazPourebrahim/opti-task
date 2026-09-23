/**
 * Auth GraphQL contract. Reuses the shared `User` type. Tokens are returned in
 * `AuthPayload` for non-browser clients and ALSO set as HTTP-only cookies by the
 * resolvers; browser clients should rely on the cookies.
 */
export const authTypeDefs = /* GraphQL */ `
  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type Session {
    id: UUID!
    userAgent: String
    ipAddress: String
    createdAt: DateTime!
    expiresAt: DateTime!
    current: Boolean!
  }

  input RegisterInput {
    email: String!
    name: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  extend type Query {
    me: User!
    sessions: [Session!]!
  }

  extend type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshToken(refreshToken: String): AuthPayload!
    logout: Boolean!
    changePassword(input: ChangePasswordInput!): Boolean!
    requestPasswordReset(email: String!): Boolean!
    revokeSession(sessionId: UUID!): Boolean!
  }
`;
