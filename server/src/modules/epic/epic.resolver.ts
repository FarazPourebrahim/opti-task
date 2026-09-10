import type { Epic, Milestone, Project, Task } from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import type { Connection, SortDirection } from '@shared/utils';
import type { TaskFilter, TaskSortField } from '@modules/task/task.model';
import * as taskService from '@modules/task/task.service';
import * as epicService from './epic.service.js';

type TaskListArgs = {
  first?: number | null;
  after?: string | null;
  filter?: TaskFilter | null;
  sortField?: TaskSortField | null;
  sortDirection?: SortDirection | null;
};

export const epicResolvers = {
  Query: {
    epic: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Epic> => epicService.getEpic(ctx, args.id),
  },

  Mutation: {
    createEpic: (
      _parent: unknown,
      args: { projectId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Epic> => epicService.createEpic(ctx, args.projectId, args.input),

    updateEpic: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Epic> => epicService.updateEpic(ctx, args.id, args.input),

    deleteEpic: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await epicService.deleteEpic(ctx, args.id);
      return true;
    },

    refreshEpicProgress: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Epic> => epicService.refreshProgress(ctx, args.id),

    createMilestone: (
      _parent: unknown,
      args: { projectId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Milestone> =>
      epicService.createMilestone(ctx, args.projectId, args.input),

    deleteMilestone: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await epicService.deleteMilestone(ctx, args.id);
      return true;
    },
  },

  Project: {
    epics: (
      project: Project,
      args: { first?: number | null; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<Connection<Epic>> =>
      epicService.listProjectEpics(ctx, project.id, args),
  },

  Epic: {
    progress: async (epic: Epic, _args: unknown): Promise<number> =>
      (await epicService.computeProgress(epic.id)).progress,

    totalTasks: async (epic: Epic, _args: unknown): Promise<number> =>
      (await epicService.computeProgress(epic.id)).totalTasks,

    completedTasks: async (epic: Epic, _args: unknown): Promise<number> =>
      (await epicService.computeProgress(epic.id)).completedTasks,

    tasks: (
      epic: Epic,
      args: TaskListArgs,
      ctx: GraphQLContext,
    ): Promise<Connection<Task>> =>
      taskService.listProjectTasks(ctx, epic.projectId, {
        ...args,
        filter: { ...(args.filter ?? {}), epicId: epic.id },
      }),

    milestones: (epic: Epic): Promise<Milestone[]> =>
      epicService.listEpicMilestones(epic.id),
  },
};
