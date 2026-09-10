/**
 * Organization GraphQL contract: organizations, membership management, and
 * invitations. `owner`/member `user` relations are resolved via DataLoaders.
 * The `projects` relation is added by the project module (Phase 6); for now an
 * organization exposes `projectCount`.
 */
export const organizationTypeDefs = /* GraphQL */ `
  enum OrgRole {
    OWNER
    ADMIN
    MEMBER
  }

  enum InvitationStatus {
    PENDING
    ACCEPTED
    REVOKED
    EXPIRED
  }

  type Organization {
    id: UUID!
    name: String!
    description: String
    logoUrl: String
    settings: JSON!
    owner: User!
    members(first: Int, after: String): OrganizationMemberConnection!
    memberCount: Int!
    projectCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type OrganizationMember {
    id: UUID!
    role: OrgRole!
    user: User!
    createdAt: DateTime!
  }

  type OrganizationMemberEdge {
    cursor: String!
    node: OrganizationMember!
  }

  type OrganizationMemberConnection {
    edges: [OrganizationMemberEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type OrganizationEdge {
    cursor: String!
    node: Organization!
  }

  type OrganizationConnection {
    edges: [OrganizationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type OrganizationInvitation {
    id: UUID!
    organizationId: UUID!
    email: String!
    role: OrgRole!
    status: InvitationStatus!
    expiresAt: DateTime
    createdAt: DateTime!
  }

  input CreateOrganizationInput {
    name: String!
    description: String
    logoUrl: String
  }

  input UpdateOrganizationInput {
    name: String
    description: String
    logoUrl: String
    settings: JSON
  }

  input InviteMemberInput {
    email: String!
    role: OrgRole
  }

  extend type Query {
    organization(id: UUID!): Organization!
    myOrganizations(first: Int, after: String): OrganizationConnection!
    organizationInvitations(organizationId: UUID!): [OrganizationInvitation!]!
  }

  extend type Mutation {
    createOrganization(input: CreateOrganizationInput!): Organization!
    updateOrganization(id: UUID!, input: UpdateOrganizationInput!): Organization!
    deleteOrganization(id: UUID!): Boolean!
    inviteToOrganization(
      organizationId: UUID!
      input: InviteMemberInput!
    ): OrganizationInvitation!
    acceptInvitation(token: String!): OrganizationMember!
    revokeInvitation(invitationId: UUID!): Boolean!
    updateMemberRole(
      organizationId: UUID!
      userId: UUID!
      role: OrgRole!
    ): OrganizationMember!
    removeMember(organizationId: UUID!, userId: UUID!): Boolean!
  }
`;
