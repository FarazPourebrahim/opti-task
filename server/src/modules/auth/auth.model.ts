import type { User } from '@prisma/client';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = AuthTokens & {
  user: User;
};

export type RegisterInput = {
  email: string;
  name: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

/**
 * Request-derived metadata stored with a session for the active-session list and
 * auditing. Never trusted for authorization — informational only.
 */
export type SessionMetadata = {
  userAgent: string | null;
  ipAddress: string | null;
};
