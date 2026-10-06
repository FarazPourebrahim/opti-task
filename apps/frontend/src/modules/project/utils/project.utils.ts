import type { ProjectRole, ProjectState, Role } from '@contracts';

/**
 * The project lifecycle, mirroring `PROJECT_STATE_TRANSITIONS` in the backend's
 * `project.model.ts`. The UI offers only these moves; the server still rejects
 * anything else, so a drift here hides or shows a button, never corrupts data.
 */
const PROJECT_STATE_TRANSITIONS: Record<ProjectState, readonly ProjectState[]> =
  {
    PLANNING: ['ACTIVE', 'ARCHIVED'],
    ACTIVE: ['COMPLETED', 'ARCHIVED'],
    COMPLETED: ['ACTIVE', 'ARCHIVED'],
    // Terminal: an archived project cannot be reopened.
    ARCHIVED: [],
  };

export function nextProjectStates(from: ProjectState): readonly ProjectState[] {
  return PROJECT_STATE_TRANSITIONS[from];
}

export function canTransitionProject(
  from: ProjectState,
  to: ProjectState,
): boolean {
  return PROJECT_STATE_TRANSITIONS[from].includes(to);
}

type ProjectMemberLike = {
  role: ProjectRole;
  user: { id: string };
};

const PROJECT_ROLE_TO_ROLE: Record<ProjectRole, Role> = {
  ADMIN: 'PROJECT_ADMIN',
  MEMBER: 'PROJECT_MEMBER',
  VIEWER: 'VIEWER',
};

/**
 * The viewer's roles on a project, for capability hints: whatever they hold on
 * the organisation, plus their own row in the project's member list.
 *
 * As with organisations, the API does not state this, and the member list is
 * paginated — a row that has not loaded contributes nothing, which can only
 * narrow what is offered.
 */
export function resolveProjectRoles(
  viewerId: string | undefined,
  organizationRoles: readonly Role[],
  members: readonly ProjectMemberLike[],
): Role[] {
  if (!viewerId) return [];

  const membership = members.find((member) => member.user.id === viewerId);

  return membership
    ? [...organizationRoles, PROJECT_ROLE_TO_ROLE[membership.role]]
    : [...organizationRoles];
}

/**
 * Parses the workflow editor's text.
 *
 * The server stores any JSON object without checking its shape, so the only
 * thing worth validating here is that it IS a JSON object — not an array, a
 * string or a number, which the API would reject.
 */
export function parseWorkflow(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false } {
  try {
    const parsed: unknown = JSON.parse(text);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false };
    }

    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}
