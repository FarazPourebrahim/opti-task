import type { Project, Sprint, SprintState, Task, User } from '@prisma/client';
import type { GraphQLContext } from '@/shared/graphql/context';
import type { Connection, SortDirection } from '@/shared/utils';
import type { TaskFilter, TaskSortField } from '@/modules/task/task.model';
import * as taskService from '@/modules/task/task.service';
import * as sprintService from '../sprint.service.js';
import type {
  BurndownPoint,
  SprintMetrics,
  SprintWorkload,
} from '../sprint.model.js';

type TaskListArgs = {
  first?: number | null;
  after?: string | null;
  filter?: TaskFilter | null;
  sortField?: TaskSortField | null;
  sortDirection?: SortDirection | null;
};

export const sprintResolvers = {
  Query: {
    sprint: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Sprint> => sprintService.getSprint(ctx, args.id),
  },

  Mutation: {
    createSprint: (
      _parent: unknown,
      args: { projectId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Sprint> =>
      sprintService.createSprint(ctx, args.projectId, args.input),

    updateSprint: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Sprint> => sprintService.updateSprint(ctx, args.id, args.input),

    changeSprintState: (
      _parent: unknown,
      args: { id: string; state: SprintState },
      ctx: GraphQLContext,
    ): Promise<Sprint> =>
      sprintService.changeSprintState(ctx, args.id, args.state),

    deleteSprint: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await sprintService.deleteSprint(ctx, args.id);
      return true;
    },

    addTaskToSprint: (
      _parent: unknown,
      args: { sprintId: string; taskId: string },
      ctx: GraphQLContext,
    ): Promise<Sprint> =>
      sprintService.addTaskToSprint(ctx, args.sprintId, args.taskId),

    removeTaskFromSprint: (
      _parent: unknown,
      args: { sprintId: string; taskId: string },
      ctx: GraphQLContext,
    ): Promise<Sprint> =>
      sprintService.removeTaskFromSprint(ctx, args.sprintId, args.taskId),
  },

  Project: {
    sprints: (
      project: Project,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<Sprint>> =>
      sprintService.listProjectSprints(ctx, project.id, args),
  },

  Sprint: {
    tasks: (
      sprint: Sprint,
      args: TaskListArgs,
      ctx: GraphQLContext,
    ): Promise<Connection<Task>> =>
      taskService.listProjectTasks(ctx, sprint.projectId, {
        ...args,
        filter: { ...(args.filter ?? {}), sprintId: sprint.id },
      }),

    taskCount: (
      sprint: Sprint,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<number> =>
      ctx.prisma.task.count({ where: { sprintId: sprint.id } }),

    metrics: (
      sprint: Sprint,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<SprintMetrics> => sprintService.getMetrics(ctx, sprint),

    burndown: (
      sprint: Sprint,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<BurndownPoint[]> => sprintService.getBurndown(ctx, sprint),
  },

  SprintWorkload: {
    user: (
      workload: SprintWorkload,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> | null =>
      workload.assigneeId ? ctx.loaders.userById.load(workload.assigneeId) : null,
  },
};
