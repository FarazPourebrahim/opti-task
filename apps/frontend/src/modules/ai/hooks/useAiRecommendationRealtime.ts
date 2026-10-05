import {
  AiRecommendationItemFragment,
  AiRecommendationUpdatedSubscription,
} from '@/modules/ai/graphql/ai.operations';
import { useRealtimeSubscription } from '@/shared/hooks/useRealtime';
import { isCached, writeEntity } from '@/shared/utils/cache.utils';

/**
 * Keeps a project's AI recommendations current while one of its screens is
 * open.
 *
 * Write source of truth: the request and decision mutations (Phase 12). When
 * someone approves, rejects or overrides a recommendation, the copy in the
 * cache takes the new status. A recommendation this client has not loaded is
 * not written — the queue that would list a new one is built in Phase 12,
 * which adds it to its lists from here.
 */
export function useAiRecommendationRealtime(projectId: string): void {
  useRealtimeSubscription(AiRecommendationUpdatedSubscription, {
    variables: { projectId },
    onEvent: (data, client) => {
      const { recommendationId, recommendation } = data.aiRecommendationUpdated;
      const entity = { __typename: 'AiRecommendation', id: recommendationId };

      if (recommendation && isCached(client.cache, entity)) {
        writeEntity(client.cache, {
          entity,
          fragment: AiRecommendationItemFragment,
          data: recommendation,
        });
      }
    },
  });
}
