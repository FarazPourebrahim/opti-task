import { graphql } from '@/shared/graphql/generated';

/**
 * Organization operations.
 *
 * `OrganizationMember` rows are selected with their `id` everywhere, so a role
 * change returned by a mutation updates every list showing that member through
 * the normalized cache — no refetch.
 */

export const MyOrganizationsQuery = graphql(`
  query MyOrganizations($first: Int, $after: String) {
    myOrganizations(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          description
          logoUrl
          memberCount
          projectCount
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

export const OrganizationQuery = graphql(`
  query Organization($id: UUID!, $first: Int, $after: String) {
    organization(id: $id) {
      id
      name
      description
      logoUrl
      memberCount
      projectCount
      owner {
        id
        name
      }
      members(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            role
            createdAt
            user {
              id
              name
              email
              avatarUrl
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`);

export const OrganizationProjectsQuery = graphql(`
  query OrganizationProjects(
    $id: UUID!
    $status: ProjectState
    $first: Int
    $after: String
  ) {
    organization(id: $id) {
      id
      projects(first: $first, after: $after, status: $status) {
        edges {
          cursor
          node {
            id
            name
            description
            status
            memberCount
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`);

export const OrganizationInvitationsQuery = graphql(`
  query OrganizationInvitations($organizationId: UUID!) {
    organizationInvitations(organizationId: $organizationId) {
      id
      email
      role
      status
      expiresAt
      createdAt
    }
  }
`);

export const CreateOrganizationMutation = graphql(`
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      id
      name
      description
      logoUrl
      memberCount
      projectCount
    }
  }
`);

export const UpdateOrganizationMutation = graphql(`
  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {
    updateOrganization(id: $id, input: $input) {
      id
      name
      description
      logoUrl
    }
  }
`);

export const DeleteOrganizationMutation = graphql(`
  mutation DeleteOrganization($id: UUID!) {
    deleteOrganization(id: $id)
  }
`);

export const UpdateMemberRoleMutation = graphql(`
  mutation UpdateMemberRole(
    $organizationId: UUID!
    $userId: UUID!
    $role: OrgRole!
  ) {
    updateMemberRole(
      organizationId: $organizationId
      userId: $userId
      role: $role
    ) {
      id
      role
    }
  }
`);

export const RemoveMemberMutation = graphql(`
  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {
    removeMember(organizationId: $organizationId, userId: $userId)
  }
`);

export const InviteToOrganizationMutation = graphql(`
  mutation InviteToOrganization(
    $organizationId: UUID!
    $input: InviteMemberInput!
  ) {
    inviteToOrganization(organizationId: $organizationId, input: $input) {
      id
      email
      role
      status
      expiresAt
      createdAt
    }
  }
`);

export const RevokeInvitationMutation = graphql(`
  mutation RevokeInvitation($invitationId: UUID!) {
    revokeInvitation(invitationId: $invitationId)
  }
`);
