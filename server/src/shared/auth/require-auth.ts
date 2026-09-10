import type { GraphQLContext, AuthenticatedUser } from '@shared/graphql/context';
import { AuthError } from '@shared/errors';

/**
 * Guards a resolver: returns the authenticated principal or throws AuthError.
 * Use at the top of any resolver/service path that requires a logged-in user.
 */
export function requireAuth(ctx: GraphQLContext): AuthenticatedUser {
  if (!ctx.user) {
    throw new AuthError();
  }
  return ctx.user;
}
