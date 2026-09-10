import type { Prisma, User } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import { requireAuth } from '@/shared/auth';
import { NotFoundError } from '@/shared/errors';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  toPrismaSortOrder,
  type Connection,
  type SortDirection,
} from '@/shared/utils';
import * as repo from './user.repository.js';
import {
  validateAddExpertise,
  validateSkill,
  validateUpdateProfile,
} from './user.validation.js';
import type { UserFilter } from './user.model.js';

const DEFAULT_EXPERTISE_CONFIDENCE = 0.5;

export async function getUser(ctx: GraphQLContext, id: string): Promise<User> {
  requireAuth(ctx);
  const user = await repo.findUserById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

export async function listUsers(
  ctx: GraphQLContext,
  args: {
    first?: number | null;
    after?: string | null;
    orderBy?: SortDirection | null;
    filter?: UserFilter | null;
  },
): Promise<Connection<User>> {
  requireAuth(ctx);

  const pageSize = clampFirst(args.first);
  const after = args.after ? decodeCursor(args.after) : null;
  const where = buildWhere(args.filter);

  const [rows, totalCount] = await Promise.all([
    repo.findUsersPage({
      where,
      orderBy: { id: toPrismaSortOrder(args.orderBy) },
      take: pageSize + 1,
      ...(after ? { cursor: after } : {}),
    }),
    repo.countUsers(where),
  ]);

  return buildConnection(rows, {
    pageSize,
    after,
    totalCount,
    getCursor: (user) => encodeCursor(user.id),
  });
}

export async function updateProfile(
  ctx: GraphQLContext,
  input: unknown,
): Promise<User> {
  const principal = requireAuth(ctx);
  const data = validateUpdateProfile(input);
  return repo.updateUser(principal.id, data as Prisma.UserUpdateInput);
}

export async function addSkill(
  ctx: GraphQLContext,
  skill: unknown,
): Promise<User> {
  const principal = requireAuth(ctx);
  const clean = validateSkill(skill);
  await repo.addSkill(principal.id, clean);
  return getSelf(ctx, principal.id);
}

export async function removeSkill(
  ctx: GraphQLContext,
  skill: unknown,
): Promise<User> {
  const principal = requireAuth(ctx);
  const clean = validateSkill(skill);
  await repo.removeSkill(principal.id, clean);
  return getSelf(ctx, principal.id);
}

export async function addExpertise(
  ctx: GraphQLContext,
  input: unknown,
): Promise<User> {
  const principal = requireAuth(ctx);
  const { tag, confidenceScore } = validateAddExpertise(input);
  await repo.upsertExpertise(
    principal.id,
    tag,
    confidenceScore ?? DEFAULT_EXPERTISE_CONFIDENCE,
  );
  return getSelf(ctx, principal.id);
}

export async function removeExpertise(
  ctx: GraphQLContext,
  tag: unknown,
): Promise<User> {
  const principal = requireAuth(ctx);
  const clean = validateSkill(tag);
  await repo.removeExpertise(principal.id, clean);
  return getSelf(ctx, principal.id);
}

async function getSelf(ctx: GraphQLContext, id: string): Promise<User> {
  const user = await repo.findUserById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  // Invalidate the cached copy so the mutation's result reflects the change.
  ctx.loaders.userById.clear(id);
  return user;
}

function buildWhere(filter: UserFilter | null | undefined): Prisma.UserWhereInput {
  if (!filter) {
    return {};
  }
  const where: Prisma.UserWhereInput = {};
  if (filter.emailContains) {
    where.email = { contains: filter.emailContains, mode: 'insensitive' };
  }
  if (filter.nameContains) {
    where.name = { contains: filter.nameContains, mode: 'insensitive' };
  }
  return where;
}
