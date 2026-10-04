import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';
import type { TaskStatus } from '@contracts';
import {
  AddTaskDependencyMutation,
  AddTaskLabelMutation,
  AssignTaskMutation,
  ChangeTaskStatusMutation,
  CreateTaskMutation,
  DeleteTaskMutation,
  LogTaskTimeMutation,
  MoveTaskToSprintMutation,
  RemoveTaskDependencyMutation,
  RemoveTaskLabelMutation,
  SetTaskStoryPointsMutation,
  UnwatchTaskMutation,
  UpdateTaskMutation,
  WatchTaskMutation,
} from '@/modules/task/graphql/task.operations';
import type {
  CreateTaskInput,
  TaskDetailsInput,
} from '@/modules/task/schemas/task.schema';
import { removeFromConnection } from '@/shared/utils/cache.utils';

/** The person a task is being given to, as the card shows them. */
export type TaskAssignee = {
  id: string;
  name: string;
  avatarUrl?: string | null | undefined;
};

export function useCreateTask(projectId: string) {
  const [create, { loading }] = useMutation(CreateTaskMutation, {
    update: (cache) => {
      // Every filter and sort is its own cached list; where the new task
      // belongs in each is the server's call, so they are all re-read.
      const cacheId = cache.identify({ __typename: 'Project', id: projectId });
      if (cacheId) cache.evict({ id: cacheId, fieldName: 'tasks' });
    },
  });

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      const result = await create({ variables: { projectId, input } });
      return result.data?.createTask ?? null;
    },
    [create, projectId],
  );

  return { createTask, isCreating: loading };
}

/*
 * Status, assignment and story points are optimistic: the card changes at once
 * and Apollo puts it back if the server refuses. Each optimistic response has
 * exactly the fields the mutation selects, so a rollback restores exactly what
 * was changed.
 */
export function useTaskQuickActions() {
  const [changeStatus] = useMutation(ChangeTaskStatusMutation);
  const [assign] = useMutation(AssignTaskMutation);
  const [setPoints] = useMutation(SetTaskStoryPointsMutation);

  const changeTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      await changeStatus({
        variables: { id: taskId, status },
        optimisticResponse: {
          changeTaskStatus: { __typename: 'Task', id: taskId, status },
        },
      });
    },
    [changeStatus],
  );

  /** `assignee` is null to unassign. */
  const assignTask = useCallback(
    async (taskId: string, assignee: TaskAssignee | null) => {
      await assign({
        variables: { id: taskId, assigneeId: assignee?.id ?? null },
        optimisticResponse: {
          assignTask: {
            __typename: 'Task',
            id: taskId,
            assigneeId: assignee?.id ?? null,
            assignee: assignee
              ? {
                  __typename: 'User',
                  id: assignee.id,
                  name: assignee.name,
                  avatarUrl: assignee.avatarUrl ?? null,
                }
              : null,
          },
        },
      });
    },
    [assign],
  );

  /** `storyPoints` is null to clear the estimate. */
  const setTaskStoryPoints = useCallback(
    async (taskId: string, storyPoints: number | null) => {
      await setPoints({
        variables: { id: taskId, storyPoints },
        optimisticResponse: {
          setTaskStoryPoints: { __typename: 'Task', id: taskId, storyPoints },
        },
      });
    },
    [setPoints],
  );

  return { changeTaskStatus, assignTask, setTaskStoryPoints };
}

/* Everything else waits for the server: each returns the task by id, so the
   cache updates every screen showing it. */
export function useTaskActions(taskId: string) {
  const [update, { loading: isUpdating }] = useMutation(UpdateTaskMutation);
  const [moveToSprint, { loading: isMoving }] = useMutation(
    MoveTaskToSprintMutation,
  );
  const [logTime, { loading: isLoggingTime }] =
    useMutation(LogTaskTimeMutation);
  const [addDependency, { loading: isAddingDependency }] = useMutation(
    AddTaskDependencyMutation,
  );
  const [removeDependency] = useMutation(RemoveTaskDependencyMutation);
  const [watch, { loading: isWatching }] = useMutation(WatchTaskMutation);
  const [unwatch, { loading: isUnwatching }] = useMutation(UnwatchTaskMutation);
  const [addLabel, { loading: isAddingLabel }] =
    useMutation(AddTaskLabelMutation);
  const [removeLabel] = useMutation(RemoveTaskLabelMutation);
  const [remove, { loading: isDeleting }] = useMutation(DeleteTaskMutation);

  const updateTask = useCallback(
    async (input: TaskDetailsInput) => {
      await update({ variables: { id: taskId, input } });
    },
    [update, taskId],
  );

  /** `sprintId` is null to take the task out of its sprint. */
  const moveTaskToSprint = useCallback(
    async (sprintId: string | null) => {
      await moveToSprint({ variables: { id: taskId, sprintId } });
    },
    [moveToSprint, taskId],
  );

  const logTaskTime = useCallback(
    async (seconds: number) => {
      await logTime({ variables: { id: taskId, seconds } });
    },
    [logTime, taskId],
  );

  const addTaskDependency = useCallback(
    async (dependsOnTaskId: string) => {
      await addDependency({ variables: { taskId, dependsOnTaskId } });
    },
    [addDependency, taskId],
  );

  const removeTaskDependency = useCallback(
    async (dependsOnTaskId: string) => {
      await removeDependency({ variables: { taskId, dependsOnTaskId } });
    },
    [removeDependency, taskId],
  );

  const setWatching = useCallback(
    async (watching: boolean) => {
      await (watching
        ? watch({ variables: { taskId } })
        : unwatch({ variables: { taskId } }));
    },
    [watch, unwatch, taskId],
  );

  const addTaskLabel = useCallback(
    async (name: string) => {
      await addLabel({ variables: { taskId, name } });
    },
    [addLabel, taskId],
  );

  const removeTaskLabel = useCallback(
    async (name: string) => {
      await removeLabel({ variables: { taskId, name } });
    },
    [removeLabel, taskId],
  );

  const deleteTask = useCallback(
    async (projectId: string) => {
      await remove({
        variables: { id: taskId },
        // The mutation returns only a boolean, so the task is taken out of
        // every cached list by hand.
        update: (cache) =>
          removeFromConnection(cache, {
            owner: { __typename: 'Project', id: projectId },
            connectionField: 'tasks',
            nodeId: taskId,
          }),
      });
    },
    [remove, taskId],
  );

  return {
    updateTask,
    isUpdating,
    moveTaskToSprint,
    isMoving,
    logTaskTime,
    isLoggingTime,
    addTaskDependency,
    isAddingDependency,
    removeTaskDependency,
    setWatching,
    isTogglingWatch: isWatching || isUnwatching,
    addTaskLabel,
    isAddingLabel,
    removeTaskLabel,
    deleteTask,
    isDeleting,
  };
}
