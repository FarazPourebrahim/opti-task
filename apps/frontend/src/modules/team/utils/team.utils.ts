import type { Role, TeamRole } from '@contracts';

type TeamMemberLike = {
  role: TeamRole;
  user: { id: string };
};

/**
 * The viewer's roles on a team, for capability hints: whatever they hold on the
 * project (and through it the organisation), plus their own row in the team.
 *
 * Roles are scoped — being lead of one team says nothing about another — so
 * this is resolved per team, never once for the whole project.
 */
export function resolveTeamRoles(
  viewerId: string | undefined,
  projectRoles: readonly Role[],
  members: readonly TeamMemberLike[],
): Role[] {
  if (!viewerId) return [];

  const membership = members.find((member) => member.user.id === viewerId);
  if (!membership) return [...projectRoles];

  return [
    ...projectRoles,
    membership.role === 'LEAD' ? 'TEAM_LEAD' : 'TEAM_MEMBER',
  ];
}
