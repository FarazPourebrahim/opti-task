import type { GraphQLContext } from '@/shared/graphql/context';
import { ForbiddenError } from '@/shared/errors';
import { requireAuth } from '@/shared/auth';
import { logSecurityEvent } from '@/shared/logger';
import { can, type Permission, type Role } from './roles.js';
import { resolveEffectiveRoles, type AuthScope } from './scope.js';
import { ownsAny } from './ownership.js';

/**
 * Authorization entry points for services/resolvers. Security decisions live
 * here (and in services), not in middleware (docs/security.md). All guards
 * require an authenticated user and deny by default.
 */

export function getEffectiveRoles(
  ctx: GraphQLContext,
  scope: AuthScope,
): Promise<Set<Role>> {
  const user = requireAuth(ctx);
  return resolveEffectiveRoles(ctx.prisma, user.id, scope);
}

/**
 * Throws `ForbiddenError` unless the user has `permission` within `scope`.
 * Returns the resolved roles for callers that need them.
 */
export async function authorize(
  ctx: GraphQLContext,
  permission: Permission,
  scope: AuthScope,
): Promise<Set<Role>> {
  const user = requireAuth(ctx);
  const roles = await resolveEffectiveRoles(ctx.prisma, user.id, scope);
  if (!can(roles, permission)) {
    logSecurityEvent(ctx, 'authz.forbidden', { permission, scope });
    throw new ForbiddenError();
  }
  return roles;
}

/**
 * Allows the action if the user owns the resource OR holds `permission` in
 * `scope`. The common pattern for "members may act on their own items, admins on
 * any" (e.g. updating a task, editing a comment).
 */
export async function authorizeOwnerOrPermission(
  ctx: GraphQLContext,
  permission: Permission,
  scope: AuthScope,
  ownerIds: Array<string | null | undefined>,
): Promise<void> {
  const user = requireAuth(ctx);
  if (ownsAny(user.id, ...ownerIds)) {
    return;
  }
  const roles = await resolveEffectiveRoles(ctx.prisma, user.id, scope);
  if (!can(roles, permission)) {
    logSecurityEvent(ctx, 'authz.ownership_violation', { permission, scope });
    throw new ForbiddenError();
  }
}
