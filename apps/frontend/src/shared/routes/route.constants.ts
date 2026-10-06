/**
 * Every path in the app.
 *
 * Components and the route tree read paths from here, so a URL can be changed
 * in one place and a link can never point at a path the router does not know.
 */
export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  acceptInvitation: '/invitations/:token',
  account: '/account',
  accountSessions: '/account/sessions',
  accountSecurity: '/account/security',
  accountProfile: '/account/profile',
  organizations: '/organizations',
  organization: '/organizations/:organizationId',
  organizationMembers: '/organizations/:organizationId/members',
  organizationInvitations: '/organizations/:organizationId/invitations',
  organizationSettings: '/organizations/:organizationId/settings',
  user: '/users/:userId',
  project: '/projects/:projectId',
  projectMembers: '/projects/:projectId/members',
  projectTeams: '/projects/:projectId/teams',
  team: '/projects/:projectId/teams/:teamId',
  projectSettings: '/projects/:projectId/settings',
  projectBoard: '/projects/:projectId/board',
  projectTasks: '/projects/:projectId/tasks',
  task: '/projects/:projectId/tasks/:taskId',
  projectSprints: '/projects/:projectId/sprints',
  sprint: '/projects/:projectId/sprints/:sprintId',
  projectEpics: '/projects/:projectId/epics',
  epic: '/projects/:projectId/epics/:epicId',
  projectAi: '/projects/:projectId/ai',
  projectAnalytics: '/projects/:projectId/analytics',
  notifications: '/notifications',
} as const;

export const ROUTE_PARAMS = {
  invitationToken: 'token',
  organizationId: 'organizationId',
  userId: 'userId',
  projectId: 'projectId',
  teamId: 'teamId',
  taskId: 'taskId',
  sprintId: 'sprintId',
  epicId: 'epicId',
} as const;

/** Query-string keys a page reads from its own address. */
export const ROUTE_SEARCH = {
  /** On a task: the comment a link points at. */
  comment: 'comment',
} as const;

/** Ids a route hands to `useBreadcrumbLabel` so its crumb shows a real name. */
export const CRUMB_IDS = {
  organization: 'organization',
  user: 'user',
  project: 'project',
  team: 'team',
  task: 'task',
  sprint: 'sprint',
  epic: 'epic',
} as const;

export function acceptInvitationPath(token: string): string {
  return `/invitations/${encodeURIComponent(token)}`;
}

export function organizationPath(organizationId: string): string {
  return `/organizations/${encodeURIComponent(organizationId)}`;
}

export function organizationMembersPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/members`;
}

export function organizationInvitationsPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/invitations`;
}

export function organizationSettingsPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/settings`;
}

export function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function projectMembersPath(projectId: string): string {
  return `${projectPath(projectId)}/members`;
}

export function projectTeamsPath(projectId: string): string {
  return `${projectPath(projectId)}/teams`;
}

export function teamPath(projectId: string, teamId: string): string {
  return `${projectTeamsPath(projectId)}/${encodeURIComponent(teamId)}`;
}

export function projectSettingsPath(projectId: string): string {
  return `${projectPath(projectId)}/settings`;
}

export function projectBoardPath(projectId: string): string {
  return `${projectPath(projectId)}/board`;
}

export function projectTasksPath(projectId: string): string {
  return `${projectPath(projectId)}/tasks`;
}

export function taskPath(projectId: string, taskId: string): string {
  return `${projectTasksPath(projectId)}/${encodeURIComponent(taskId)}`;
}

/** A task, opened on one of its comments. */
export function taskCommentPath(
  projectId: string,
  taskId: string,
  commentId: string,
): string {
  const search = new URLSearchParams({ [ROUTE_SEARCH.comment]: commentId });
  return `${taskPath(projectId, taskId)}?${search.toString()}`;
}

export function projectSprintsPath(projectId: string): string {
  return `${projectPath(projectId)}/sprints`;
}

export function sprintPath(projectId: string, sprintId: string): string {
  return `${projectSprintsPath(projectId)}/${encodeURIComponent(sprintId)}`;
}

export function projectEpicsPath(projectId: string): string {
  return `${projectPath(projectId)}/epics`;
}

export function epicPath(projectId: string, epicId: string): string {
  return `${projectEpicsPath(projectId)}/${encodeURIComponent(epicId)}`;
}

export function projectAiPath(projectId: string): string {
  return `${projectPath(projectId)}/ai`;
}

export function projectAnalyticsPath(projectId: string): string {
  return `${projectPath(projectId)}/analytics`;
}

export function userPath(userId: string): string {
  return `/users/${encodeURIComponent(userId)}`;
}
