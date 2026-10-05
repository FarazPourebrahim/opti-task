import {
  SprintSummaryFragment,
  SprintUpdatedSubscription,
} from '@/modules/sprint/graphql/sprint.operations';
import { useRealtimeSubscription } from '@/shared/hooks/useRealtime';
import { announceRealtimeEvent } from '@/shared/services/realtime.events';
import { isCached, writeEntity } from '@/shared/utils/cache.utils';

/**
 * Keeps a project's sprints current while one of its screens is open.
 *
 * Write source of truth: the sprint mutations. When someone starts, completes
 * or cancels a sprint, the copy in the cache takes the new state, so the list
 * and the sprint's own page follow. A sprint this client has not loaded is not
 * written. The sprint's figures are the server's to work out, so the page
 * re-reads them when it hears the event passed on.
 */
export function useSprintRealtime(projectId: string): void {
  useRealtimeSubscription(SprintUpdatedSubscription, {
    variables: { projectId },
    onEvent: (data, client) => {
      const { sprintId, sprint } = data.sprintUpdated;
      const entity = { __typename: 'Sprint', id: sprintId };

      if (sprint && isCached(client.cache, entity)) {
        writeEntity(client.cache, {
          entity,
          fragment: SprintSummaryFragment,
          data: sprint,
        });
      }

      announceRealtimeEvent('sprintUpdated', { sprintId, projectId });
    },
  });
}
