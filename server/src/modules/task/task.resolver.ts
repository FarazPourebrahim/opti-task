import type {
  Label,
  Project,
  Task,
  TaskStatus,
  User,
} from '@prisma/client';
import type { GraphQLContext } from '@shared/graphql/context';
import type { Connection, SortDirection } from '@shared/utils';
import type { TaskFilter, TaskSortField } from './task.model.js';
import * as taskService from './task.service.js';

export const taskResolvers = {
  Query: {
    task: (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.getTask(ctx, args.id),
  },

  Mutation: {
    createTask: (
      _parent: unknown,
      args: { projectId: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.createTask(ctx, args.projectId, args.input),

    updateTask: (
      _parent: unknown,
      args: { id: string; input: unknown },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.updateTask(ctx, args.id, args.input),

    changeTaskStatus: (
      _parent: unknown,
      args: { id: string; status: TaskStatus },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.changeStatus(ctx, args.id, args.status),

    assignTask: (
      _parent: unknown,
      args: { id: string; assigneeId?: string | null },
      ctx: GraphQLContext,
    ): Promise<Task> =>
      taskService.assignTask(ctx, args.id, args.assigneeId ?? null),

    setTaskStoryPoints: (
      _parent: unknown,
      args: { id: string; storyPoints?: number | null },
      ctx: GraphQLContext,
    ): Promise<Task> =>
      taskService.setStoryPoints(ctx, args.id, args.storyPoints ?? null),

    moveTaskToSprint: (
      _parent: unknown,
      args: { id: string; sprintId?: string | null },
      ctx: GraphQLContext,
    ): Promise<Task> =>
      taskService.moveToSprint(ctx, args.id, args.sprintId ?? null),

    deleteTask: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext,
    ): Promise<boolean> => {
      await taskService.deleteTask(ctx, args.id);
      return true;
    },

    logTaskTime: (
      _parent: unknown,
      args: { id: string; seconds: number },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.logTime(ctx, args.id, args.seconds),

    addTaskDependency: (
      _parent: unknown,
      args: { taskId: string; dependsOnTaskId: string },
      ctx: GraphQLContext,
    ): Promise<Task> =>
      taskService.addDependency(ctx, args.taskId, args.dependsOnTaskId),

    removeTaskDependency: (
      _parent: unknown,
      args: { taskId: string; dependsOnTaskId: string },
      ctx: GraphQLContext,
    ): Promise<Task> =>
      taskService.removeDependency(ctx, args.taskId, args.dependsOnTaskId),

    watchTask: (
      _parent: unknown,
      args: { taskId: string },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.watchTask(ctx, args.taskId),

    unwatchTask: (
      _parent: unknown,
      args: { taskId: string },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.unwatchTask(ctx, args.taskId),

    addTaskLabel: (
      _parent: unknown,
      args: { taskId: string; name: string },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.addLabel(ctx, args.taskId, args.name),

    removeTaskLabel: (
      _parent: unknown,
      args: { taskId: string; name: string },
      ctx: GraphQLContext,
    ): Promise<Task> => taskService.removeLabel(ctx, args.taskId, args.name),
  },

  Project: {
    tasks: (
      project: Project,
      args: {
        first?: number | null;
        after?: string | null;
        filter?: TaskFilter | null;
        sortField?: TaskSortField | null;
        sortDirection?: SortDirection | null;
      },
      ctx: GraphQLContext,
    ): Promise<Connection<Task>> =>
      taskService.listProjectTasks(ctx, project.id, args),
  },

  Task: {
    estimatedSeconds: (task: Task): number | null =>
      task.estimatedSeconds === null ? null : Number(task.estimatedSeconds),

    loggedSeconds: (task: Task): number => Number(task.loggedSeconds),

    assignee: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> | null =>
      task.assigneeId ? ctx.loaders.userById.load(task.assigneeId) : null,

    reporter: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User | null> | null =>
      task.reporterId ? ctx.loaders.userById.load(task.reporterId) : null,

    labels: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Label[]> => ctx.loaders.labelsByTaskId.load(task.id),

    watchers: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<User[]> => ctx.loaders.watchersByTaskId.load(task.id),

    dependencies: (
      task: Task,
      _args: unknown,
      ctx: GraphQLContext,
    ): Promise<Task[]> => ctx.loaders.dependsOnByTaskId.load(task.id),
  },
};
