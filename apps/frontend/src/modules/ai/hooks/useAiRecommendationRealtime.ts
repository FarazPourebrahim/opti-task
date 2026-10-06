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
 * Write source of truth: the decision mutations. When someone approves,
 * rejects or overrides a recommendation, the copy in the cache takes the new
 * status, so a card on screen shows their decision and stops offering one.
 * A recommendation this client has not loaded is not written.
 *
 * The API announces decisions only. A suggestion someone else has just asked
 * for is not announced, and appears with the queue's next fetch.
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
