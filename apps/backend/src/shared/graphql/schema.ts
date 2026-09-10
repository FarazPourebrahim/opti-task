import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { baseTypeDefs } from './base.js';
import { scalarResolvers } from './scalars.js';
import { healthResolvers, healthTypeDefs } from './health.js';
import { authTypeDefs } from '@/modules/auth/graphql/auth.typeDefs';
import { authResolvers } from '@/modules/auth/graphql/auth.resolvers';
import { userTypeDefs } from '@/modules/user/graphql/user.typeDefs';
import { userResolvers } from '@/modules/user/graphql/user.resolvers';
import { organizationTypeDefs } from '@/modules/organization/graphql/organization.typeDefs';
import { organizationResolvers } from '@/modules/organization/graphql/organization.resolvers';
import { projectTypeDefs } from '@/modules/project/graphql/project.typeDefs';
import { projectResolvers } from '@/modules/project/graphql/project.resolvers';
import { teamTypeDefs } from '@/modules/team/graphql/team.typeDefs';
import { teamResolvers } from '@/modules/team/graphql/team.resolvers';
import { taskTypeDefs } from '@/modules/task/graphql/task.typeDefs';
import { taskResolvers } from '@/modules/task/graphql/task.resolvers';
import { activityTypeDefs } from '@/modules/activity/graphql/activity.typeDefs';
import { activityResolvers } from '@/modules/activity/graphql/activity.resolvers';
import { sprintTypeDefs } from '@/modules/sprint/graphql/sprint.typeDefs';
import { sprintResolvers } from '@/modules/sprint/graphql/sprint.resolvers';
import { epicTypeDefs } from '@/modules/epic/graphql/epic.typeDefs';
import { epicResolvers } from '@/modules/epic/graphql/epic.resolvers';
import { commentTypeDefs } from '@/modules/comment/graphql/comment.typeDefs';
import { commentResolvers } from '@/modules/comment/graphql/comment.resolvers';
import { notificationTypeDefs } from '@/modules/notification/graphql/notification.typeDefs';
import { notificationResolvers } from '@/modules/notification/graphql/notification.resolvers';
import { aiTypeDefs } from '@/modules/ai/graphql/ai.typeDefs';
import { aiResolvers } from '@/modules/ai/graphql/ai.resolvers';
import { analyticsTypeDefs } from '@/modules/analytics/graphql/analytics.typeDefs';
import { analyticsResolvers } from '@/modules/analytics/graphql/analytics.resolvers';
import { realtimeTypeDefs } from '@/modules/realtime/graphql/realtime.typeDefs';
import { realtimeResolvers } from '@/modules/realtime/graphql/realtime.resolvers';

/**
 * Composes the executable schema from the base scaffolding plus every module's
 * typeDefs/resolvers. New modules register by adding their pair to these arrays
 * — they extend the shared `Query`/`Mutation` roots declared in base.ts.
 */
const typeDefs = [
  baseTypeDefs,
  healthTypeDefs,
  authTypeDefs,
  userTypeDefs,
  organizationTypeDefs,
  projectTypeDefs,
  teamTypeDefs,
  taskTypeDefs,
  activityTypeDefs,
  sprintTypeDefs,
  epicTypeDefs,
  commentTypeDefs,
  notificationTypeDefs,
  aiTypeDefs,
  analyticsTypeDefs,
  realtimeTypeDefs,
];

const resolvers = [
  scalarResolvers,
  healthResolvers,
  authResolvers,
  userResolvers,
  organizationResolvers,
  projectResolvers,
  teamResolvers,
  taskResolvers,
  activityResolvers,
  sprintResolvers,
  epicResolvers,
  commentResolvers,
  notificationResolvers,
  aiResolvers,
  analyticsResolvers,
  realtimeResolvers,
];

export function buildSchema(): GraphQLSchema {
  return makeExecutableSchema({ typeDefs, resolvers });
}
