import type { OrgRole, Role } from '@contracts';

type MemberLike = {
  role: OrgRole;
  user: { id: string };
};

/**
 * The viewer's roles on an organisation, for capability hints.
 *
 * The API does not say what the viewer may do — only who the owner is and who
 * the members are. So the role is read off those: the owner, otherwise the
 * viewer's own row in the member list.
 *
 * The list is paginated. If the viewer's row has not been loaded they are
 * treated as a plain member — the least-privileged reading — so a hint never
 * offers an action on a guess. The server decides either way.
 */
export function resolveOrganizationRoles(
  viewerId: string | undefined,
  ownerId: string,
  members: readonly MemberLike[],
): Role[] {
  if (!viewerId) return [];
  if (viewerId === ownerId) return ['ORG_OWNER'];

  const membership = members.find((member) => member.user.id === viewerId);
  if (membership?.role === 'OWNER') return ['ORG_OWNER'];
  if (membership?.role === 'ADMIN') return ['ORG_ADMIN'];

  return ['ORG_MEMBER'];
}
