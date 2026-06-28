import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { baseTypeDefs } from './base.js';
import { scalarResolvers } from './scalars.js';
import { healthResolvers, healthTypeDefs } from './health.js';
import { authTypeDefs } from '@modules/auth/auth.schema';
import { authResolvers } from '@modules/auth/auth.resolver';
import { userTypeDefs } from '@modules/user/user.schema';
import { userResolvers } from '@modules/user/user.resolver';
import { organizationTypeDefs } from '@modules/organization/organization.schema';
import { organizationResolvers } from '@modules/organization/organization.resolver';
import { projectTypeDefs } from '@modules/project/project.schema';
import { projectResolvers } from '@modules/project/project.resolver';
import { teamTypeDefs } from '@modules/team/team.schema';
import { teamResolvers } from '@modules/team/team.resolver';
import { taskTypeDefs } from '@modules/task/task.schema';
import { taskResolvers } from '@modules/task/task.resolver';
import { activityTypeDefs } from '@modules/activity/activity.schema';
import { activityResolvers } from '@modules/activity/activity.resolver';
import { sprintTypeDefs } from '@modules/sprint/sprint.schema';
import { sprintResolvers } from '@modules/sprint/sprint.resolver';
import { epicTypeDefs } from '@modules/epic/epic.schema';
import { epicResolvers } from '@modules/epic/epic.resolver';
import { commentTypeDefs } from '@modules/comment/comment.schema';
import { commentResolvers } from '@modules/comment/comment.resolver';
import { notificationTypeDefs } from '@modules/notification/notification.schema';
import { notificationResolvers } from '@modules/notification/notification.resolver';
import { aiTypeDefs } from '@modules/ai/ai.schema';
import { aiResolvers } from '@modules/ai/ai.resolver';
import { analyticsTypeDefs } from '@modules/analytics/analytics.schema';
import { analyticsResolvers } from '@modules/analytics/analytics.resolver';
import { realtimeTypeDefs } from '@modules/realtime/realtime.schema';
import { realtimeResolvers } from '@modules/realtime/realtime.resolver';

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
