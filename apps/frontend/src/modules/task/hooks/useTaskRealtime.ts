import {
  TaskDetailFragment,
  TaskUpdatedSubscription,
} from '@/modules/task/graphql/task.operations';
import { useRealtimeSubscription } from '@/shared/hooks/useRealtime';
import { announceRealtimeEvent } from '@/shared/services/realtime.events';
import { isCached, writeEntity } from '@/shared/utils/cache.utils';

/**
 * Keeps a project's tasks current while one of its screens is open.
 *
 * Write source of truth: the task mutations. This only reconciles — when
 * someone changes a task, the copy in the cache is replaced with the task as
 * the event carries it, so the board, the list and the detail page all follow
 * without a request. A task this client has not loaded is not written.
 *
 * The event is then passed on inside the app for screens that show something
 * it does not carry: the task's audit trail, a sprint's figures, an epic's
 * progress.
 */
export function useTaskRealtime(projectId: string): void {
  useRealtimeSubscription(TaskUpdatedSubscription, {
    variables: { projectId },
    onEvent: (data, client) => {
      const { taskId, task } = data.taskUpdated;
      const entity = { __typename: 'Task', id: taskId };

      if (task && isCached(client.cache, entity)) {
        writeEntity(client.cache, {
          entity,
          fragment: TaskDetailFragment,
          fragmentName: 'TaskDetail',
          data: task,
        });
      }

      announceRealtimeEvent('taskUpdated', { taskId, projectId });
    },
  });
}
