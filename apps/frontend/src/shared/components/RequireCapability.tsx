import type { ReactNode } from 'react';
import type { Permission, Role } from '@contracts';
import { can } from '@/shared/lib/capabilities';

type RequireCapabilityProps = {
  /** The roles the user holds on the resource this action belongs to. */
  roles: readonly Role[];
  permission: Permission;
  children: ReactNode;
  /** Rendered instead when the hint says no. Defaults to nothing. */
  fallback?: ReactNode;
};

/**
 * Hides an action the user would be refused.
 *
 * This is a hint, never a guard: the server re-checks every action, and
 * whatever is rendered inside must still handle `FORBIDDEN`.
 */
export function RequireCapability({
  roles,
  permission,
  children,
  fallback = null,
}: RequireCapabilityProps) {
  return <>{can(roles, permission) ? children : fallback}</>;
}
