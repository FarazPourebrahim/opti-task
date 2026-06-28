import type { Session, User } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import {
  requireAuth,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_COOKIE,
} from '@shared/auth';
import { AuthError } from '@shared/errors';
import * as authService from './auth.service.js';
import type {
  AuthResult,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from './auth.model.js';

function sessionMetadata(ctx: GraphQLContext) {
  return { userAgent: ctx.userAgent, ipAddress: ctx.ipAddress };
}

export const authResolvers = {
  Query: {
    me: async (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User> => {
      const principal = requireAuth(ctx);
      const user = await ctx.prisma.user.findUnique({
        where: { id: principal.id },
      });
      if (!user) {
        throw new AuthError('User no longer exists');
      }
      return user;
    },

    sessions: (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Session[]> => {
      const principal = requireAuth(ctx);
      return authService.listSessions(principal.id);
    },
  },

  Mutation: {
    register: async (
      _parent: unknown,
      args: { input: RegisterInput },
      ctx: GraphQLContext,
    ): Promise<AuthResult> => {
      const result = await authService.register(args.input, sessionMetadata(ctx));
      setAuthCookies(ctx.res, result);
      return result;
    },

    login: async (
      _parent: unknown,
      args: { input: LoginInput },
      ctx: GraphQLContext,
    ): Promise<AuthResult> => {
      const result = await authService.login(args.input, sessionMetadata(ctx));
      setAuthCookies(ctx.res, result);
      return result;
    },

    refreshToken: async (
      _parent: unknown,
      args: { refreshToken?: string | null },
      ctx: GraphQLContext,
    ): Promise<AuthResult> => {
      const token = args.refreshToken ?? ctx.cookies[REFRESH_COOKIE] ?? null;
      const result = await authService.refresh(token);
      setAuthCookies(ctx.res, result);
      return result;
    },

    logout: async (
      _parent: unknown,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const principal = requireAuth(ctx);
      await authService.logout(principal.sessionId);
      clearAuthCookies(ctx.res);
      return true;
    },

    changePassword: async (
      _parent: unknown,
      args: { input: ChangePasswordInput },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const principal = requireAuth(ctx);
      await authService.changePassword(
        principal.id,
        principal.sessionId,
        args.input,
      );
      return true;
    },

    requestPasswordReset: async (
      _parent: unknown,
      args: { email: string },
    ): Promise<boolean> => {
      await authService.requestPasswordReset(args.email);
      return true;
    },

    revokeSession: async (
      _parent: unknown,
      args: { sessionId: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      const principal = requireAuth(ctx);
      await authService.revokeSession(principal.id, args.sessionId);
      return true;
    },
  },

  Session: {
    current: (parent: Session, _args: unknown, ctx: GraphQLContext): boolean =>
      parent.id === ctx.user?.sessionId,
  },
};
