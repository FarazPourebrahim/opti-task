import type { Prisma, User } from '@prisma/client';
import type { GraphQLContext } from './context.js';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
  type Connection,
} from '@shared/utils';
import { toPrismaSortOrder, type SortDirection } from '@shared/utils/sort.js';

/**
 * DEMO / platform self-test query. Proves the cross-cutting GraphQL spine end to
 * end: cursor pagination (`UserConnection`), filtering, sorting, custom scalars
 * (UUID/DateTime), and DataLoader-backed field resolution (`organizationCount`).
 *
 * This thin read-only `users` query is superseded by the full User module in
 * ROADMAP Phase 5 — keep the pagination/loader wiring, replace the resolver.
 */
export const demoTypeDefs = /* GraphQL */ `
  type User {
    id: UUID!
    email: String!
    name: String!
    createdAt: DateTime!
    organizationCount: Int!
  }

  type UserEdge {
    cursor: String!
    node: User!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input UserFilter {
    emailContains: String
  }

  extend type Query {
    users(
      first: Int
      after: String
      orderBy: SortDirection
      filter: UserFilter
    ): UserConnection!
  }
`;

type UsersArgs = {
  first?: number | null;
  after?: string | null;
  orderBy?: SortDirection | null;
  filter?: { emailContains?: string | null } | null;
};

function buildWhere(filter: UsersArgs['filter']): Prisma.UserWhereInput {
  if (!filter?.emailContains) {
    return {};
  }
  return { email: { contains: filter.emailContains, mode: 'insensitive' } };
}

export const demoResolvers = {
  Query: {
    users: async (
      _parent: unknown,
      args: UsersArgs,
      ctx: GraphQLContext,
    ): Promise<Connection<User>> => {
      const pageSize = clampFirst(args.first);
      const after = args.after ? decodeCursor(args.after) : null;
      const where = buildWhere(args.filter);

      const [rows, totalCount] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          orderBy: { id: toPrismaSortOrder(args.orderBy) },
          take: pageSize + 1,
          ...(after ? { cursor: { id: after }, skip: 1 } : {}),
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return buildConnection(rows, {
        pageSize,
        after,
        totalCount,
        getCursor: (user) => encodeCursor(user.id),
      });
    },
  },

  User: {
    organizationCount: (
      user: User,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => ctx.loaders.organizationCountByUserId.load(user.id),
  },
};
