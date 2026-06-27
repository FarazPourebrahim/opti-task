export { hashPassword, verifyPassword } from './password.js';
export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './tokens.js';
export type { AccessTokenPayload, RefreshTokenPayload } from './tokens.js';
export { hashRefreshToken, refreshHashMatches } from './refresh-hash.js';
export {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
} from './cookies.js';
export { requireAuth } from './require-auth.js';
export {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  can,
  ownsAny,
  resolveEffectiveRoles,
  getEffectiveRoles,
  authorize,
  authorizeOwnerOrPermission,
} from './rbac/index.js';
export type { Role, Permission, AuthScope } from './rbac/index.js';
