/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  '\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n': typeof types.CurrentUserDocument;
  '\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n': typeof types.LoginDocument;
  '\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n': typeof types.RegisterDocument;
  '\n  mutation Logout {\n    logout\n  }\n': typeof types.LogoutDocument;
  '\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n': typeof types.SessionsDocument;
  '\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n': typeof types.RevokeSessionDocument;
  '\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n': typeof types.ChangePasswordDocument;
  '\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n': typeof types.RequestPasswordResetDocument;
  '\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n': typeof types.AcceptInvitationDocument;
  '\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n': typeof types.MyNotificationsDocument;
  '\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n': typeof types.UnreadNotificationCountDocument;
  '\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n': typeof types.MyOrganizationsDocument;
  '\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.OrganizationDocument;
  '\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n': typeof types.OrganizationProjectsDocument;
  '\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n': typeof types.OrganizationInvitationsDocument;
  '\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n': typeof types.CreateOrganizationDocument;
  '\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n': typeof types.UpdateOrganizationDocument;
  '\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n': typeof types.DeleteOrganizationDocument;
  '\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n': typeof types.UpdateMemberRoleDocument;
  '\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n': typeof types.RemoveMemberDocument;
  '\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n': typeof types.InviteToOrganizationDocument;
  '\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n': typeof types.RevokeInvitationDocument;
  '\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n': typeof types.ProjectDocument;
  '\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n': typeof types.CreateProjectDocument;
  '\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n': typeof types.UpdateProjectDocument;
  '\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n': typeof types.ChangeProjectStatusDocument;
  '\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n': typeof types.DeleteProjectDocument;
  '\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n': typeof types.ConfigureWorkflowDocument;
  '\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n': typeof types.AddProjectMemberDocument;
  '\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n': typeof types.UpdateProjectMemberRoleDocument;
  '\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n': typeof types.RemoveProjectMemberDocument;
  '\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n': typeof types.TeamDocument;
  '\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n': typeof types.CreateTeamDocument;
  '\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n': typeof types.UpdateTeamDocument;
  '\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n': typeof types.DeleteTeamDocument;
  '\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n': typeof types.AddTeamMemberDocument;
  '\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n': typeof types.UpdateTeamMemberDocument;
  '\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n': typeof types.RemoveTeamMemberDocument;
  '\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n': typeof types.MyProfileDocument;
  '\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n': typeof types.UserProfileDocument;
  '\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n': typeof types.UpdateProfileDocument;
  '\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n': typeof types.AddSkillDocument;
  '\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n': typeof types.RemoveSkillDocument;
  '\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n': typeof types.AddExpertiseDocument;
  '\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n': typeof types.RemoveExpertiseDocument;
  '\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n': typeof types.HealthDocument;
};
const documents: Documents = {
  '\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n':
    types.CurrentUserDocument,
  '\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n':
    types.LoginDocument,
  '\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n':
    types.RegisterDocument,
  '\n  mutation Logout {\n    logout\n  }\n': types.LogoutDocument,
  '\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n':
    types.SessionsDocument,
  '\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n':
    types.RevokeSessionDocument,
  '\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n':
    types.ChangePasswordDocument,
  '\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n':
    types.RequestPasswordResetDocument,
  '\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n':
    types.AcceptInvitationDocument,
  '\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n':
    types.MyNotificationsDocument,
  '\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n':
    types.UnreadNotificationCountDocument,
  '\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n':
    types.MyOrganizationsDocument,
  '\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.OrganizationDocument,
  '\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n':
    types.OrganizationProjectsDocument,
  '\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n':
    types.OrganizationInvitationsDocument,
  '\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n':
    types.CreateOrganizationDocument,
  '\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n':
    types.UpdateOrganizationDocument,
  '\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n':
    types.DeleteOrganizationDocument,
  '\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n':
    types.UpdateMemberRoleDocument,
  '\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n':
    types.RemoveMemberDocument,
  '\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n':
    types.InviteToOrganizationDocument,
  '\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n':
    types.RevokeInvitationDocument,
  '\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n':
    types.ProjectDocument,
  '\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n':
    types.CreateProjectDocument,
  '\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n':
    types.UpdateProjectDocument,
  '\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n':
    types.ChangeProjectStatusDocument,
  '\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n':
    types.DeleteProjectDocument,
  '\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n':
    types.ConfigureWorkflowDocument,
  '\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n':
    types.AddProjectMemberDocument,
  '\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n':
    types.UpdateProjectMemberRoleDocument,
  '\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n':
    types.RemoveProjectMemberDocument,
  '\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n':
    types.TeamDocument,
  '\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n':
    types.CreateTeamDocument,
  '\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n':
    types.UpdateTeamDocument,
  '\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n':
    types.DeleteTeamDocument,
  '\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n':
    types.AddTeamMemberDocument,
  '\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n':
    types.UpdateTeamMemberDocument,
  '\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n':
    types.RemoveTeamMemberDocument,
  '\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n':
    types.MyProfileDocument,
  '\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n':
    types.UserProfileDocument,
  '\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n':
    types.UpdateProfileDocument,
  '\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n':
    types.AddSkillDocument,
  '\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n':
    types.RemoveSkillDocument,
  '\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n':
    types.AddExpertiseDocument,
  '\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n':
    types.RemoveExpertiseDocument,
  '\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n':
    types.HealthDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n',
): (typeof documents)['\n  query CurrentUser {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      organizationCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation Login($input: LoginInput!) {\n    login(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      accessToken\n      user {\n        id\n        email\n        name\n        avatarUrl\n        seniority\n        organizationCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation Logout {\n    logout\n  }\n',
): (typeof documents)['\n  mutation Logout {\n    logout\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n',
): (typeof documents)['\n  query Sessions {\n    sessions {\n      id\n      userAgent\n      ipAddress\n      createdAt\n      expiresAt\n      current\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n',
): (typeof documents)['\n  mutation RevokeSession($sessionId: UUID!) {\n    revokeSession(sessionId: $sessionId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n',
): (typeof documents)['\n  mutation ChangePassword($input: ChangePasswordInput!) {\n    changePassword(input: $input)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n',
): (typeof documents)['\n  mutation RequestPasswordReset($email: String!) {\n    requestPasswordReset(email: $email)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AcceptInvitation($token: String!) {\n    acceptInvitation(token: $token) {\n      id\n      role\n      user {\n        id\n        name\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n',
): (typeof documents)['\n  query MyNotifications($first: Int, $after: String, $unreadOnly: Boolean) {\n    myNotifications(first: $first, after: $after, unreadOnly: $unreadOnly) {\n      edges {\n        cursor\n        node {\n          id\n          type\n          title\n          body\n          read\n          createdAt\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n',
): (typeof documents)['\n  query UnreadNotificationCount {\n    unreadNotificationCount\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n',
): (typeof documents)['\n  query MyOrganizations($first: Int, $after: String) {\n    myOrganizations(first: $first, after: $after) {\n      edges {\n        cursor\n        node {\n          id\n          name\n          description\n          logoUrl\n          memberCount\n          projectCount\n        }\n      }\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      totalCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Organization($id: UUID!, $first: Int, $after: String) {\n    organization(id: $id) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n      owner {\n        id\n        name\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n',
): (typeof documents)['\n  query OrganizationProjects(\n    $id: UUID!\n    $status: ProjectState\n    $first: Int\n    $after: String\n  ) {\n    organization(id: $id) {\n      id\n      projects(first: $first, after: $after, status: $status) {\n        edges {\n          cursor\n          node {\n            id\n            name\n            description\n            status\n            memberCount\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n',
): (typeof documents)['\n  query OrganizationInvitations($organizationId: UUID!) {\n    organizationInvitations(organizationId: $organizationId) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateOrganization($input: CreateOrganizationInput!) {\n    createOrganization(input: $input) {\n      id\n      name\n      description\n      logoUrl\n      memberCount\n      projectCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateOrganization($id: UUID!, $input: UpdateOrganizationInput!) {\n    updateOrganization(id: $id, input: $input) {\n      id\n      name\n      description\n      logoUrl\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteOrganization($id: UUID!) {\n    deleteOrganization(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateMemberRole(\n    $organizationId: UUID!\n    $userId: UUID!\n    $role: OrgRole!\n  ) {\n    updateMemberRole(\n      organizationId: $organizationId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n',
): (typeof documents)['\n  mutation RemoveMember($organizationId: UUID!, $userId: UUID!) {\n    removeMember(organizationId: $organizationId, userId: $userId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n',
): (typeof documents)['\n  mutation InviteToOrganization(\n    $organizationId: UUID!\n    $input: InviteMemberInput!\n  ) {\n    inviteToOrganization(organizationId: $organizationId, input: $input) {\n      id\n      email\n      role\n      status\n      expiresAt\n      createdAt\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n',
): (typeof documents)['\n  mutation RevokeInvitation($invitationId: UUID!) {\n    revokeInvitation(invitationId: $invitationId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Project($id: UUID!, $first: Int, $after: String) {\n    project(id: $id) {\n      id\n      name\n      description\n      status\n      organizationId\n      memberCount\n      teamCount\n      settings {\n        workflow\n      }\n      members(first: $first, after: $after) {\n        edges {\n          cursor\n          node {\n            id\n            role\n            createdAt\n            user {\n              id\n              name\n              email\n              avatarUrl\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n          endCursor\n        }\n        totalCount\n      }\n      teams {\n        id\n        name\n        description\n        memberCount\n        members {\n          id\n          role\n          user {\n            id\n          }\n        }\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateProject($organizationId: UUID!, $input: CreateProjectInput!) {\n    createProject(organizationId: $organizationId, input: $input) {\n      id\n      name\n      description\n      status\n      memberCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateProject($id: UUID!, $input: UpdateProjectInput!) {\n    updateProject(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n',
): (typeof documents)['\n  mutation ChangeProjectStatus($id: UUID!, $status: ProjectState!) {\n    changeProjectStatus(id: $id, status: $status) {\n      id\n      status\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteProject($id: UUID!) {\n    deleteProject(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation ConfigureWorkflow($id: UUID!, $workflow: JSON!) {\n    configureWorkflow(id: $id, workflow: $workflow) {\n      id\n      settings {\n        workflow\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n',
): (typeof documents)['\n  mutation AddProjectMember(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {\n      id\n      role\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateProjectMemberRole(\n    $projectId: UUID!\n    $userId: UUID!\n    $role: ProjectRole!\n  ) {\n    updateProjectMemberRole(\n      projectId: $projectId\n      userId: $userId\n      role: $role\n    ) {\n      id\n      role\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n',
): (typeof documents)['\n  mutation RemoveProjectMember($projectId: UUID!, $userId: UUID!) {\n    removeProjectMember(projectId: $projectId, userId: $userId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n',
): (typeof documents)['\n  query Team($id: UUID!) {\n    team(id: $id) {\n      id\n      name\n      description\n      projectId\n      memberCount\n      members {\n        id\n        role\n        responsibilities\n        availability\n        workload\n        createdAt\n        user {\n          id\n          name\n          email\n          avatarUrl\n        }\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n',
): (typeof documents)['\n  mutation CreateTeam($projectId: UUID!, $input: CreateTeamInput!) {\n    createTeam(projectId: $projectId, input: $input) {\n      id\n      name\n      description\n      memberCount\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateTeam($id: UUID!, $input: UpdateTeamInput!) {\n    updateTeam(id: $id, input: $input) {\n      id\n      name\n      description\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n',
): (typeof documents)['\n  mutation DeleteTeam($id: UUID!) {\n    deleteTeam(id: $id)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n',
): (typeof documents)['\n  mutation AddTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: AddTeamMemberInput!\n  ) {\n    addTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateTeamMember(\n    $teamId: UUID!\n    $userId: UUID!\n    $input: UpdateTeamMemberInput!\n  ) {\n    updateTeamMember(teamId: $teamId, userId: $userId, input: $input) {\n      id\n      role\n      responsibilities\n      availability\n      workload\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n',
): (typeof documents)['\n  mutation RemoveTeamMember($teamId: UUID!, $userId: UUID!) {\n    removeTeamMember(teamId: $teamId, userId: $userId)\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n',
): (typeof documents)['\n  query MyProfile {\n    me {\n      id\n      email\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n',
): (typeof documents)['\n  query UserProfile($id: UUID!) {\n    user(id: $id) {\n      id\n      name\n      avatarUrl\n      seniority\n      skills\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n      teamMemberships {\n        teamId\n        teamName\n        role\n        availability\n        workload\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n',
): (typeof documents)['\n  mutation UpdateProfile($input: UpdateProfileInput!) {\n    updateProfile(input: $input) {\n      id\n      name\n      avatarUrl\n      seniority\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n',
): (typeof documents)['\n  mutation AddSkill($skill: String!) {\n    addSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveSkill($skill: String!) {\n    removeSkill(skill: $skill) {\n      id\n      skills\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation AddExpertise($input: AddExpertiseInput!) {\n    addExpertise(input: $input) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n',
): (typeof documents)['\n  mutation RemoveExpertise($tag: String!) {\n    removeExpertise(tag: $tag) {\n      id\n      expertise {\n        id\n        tag\n        confidenceScore\n      }\n    }\n  }\n'];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: '\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n',
): (typeof documents)['\n  query Health {\n    health {\n      status\n      uptimeSeconds\n      timestamp\n    }\n  }\n'];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
