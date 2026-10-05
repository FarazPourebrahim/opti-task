import { Alert, Button } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { Role } from '@contracts';
import { RecommendationCard } from '@/modules/ai/components/RecommendationCard';
import { RecommendationDecision } from '@/modules/ai/components/RecommendationDecision';
import type { AiRequestKind } from '@/modules/ai/constants/ai.constants';
import {
  useAiRecommendation,
  useAiRequests,
} from '@/modules/ai/hooks/useAiRecommendations';
import { aiCapabilities } from '@/modules/ai/utils/ai.utils';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { AppLink } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { ApiError } from '@/shared/lib/apiError';
import { projectAiPath } from '@/shared/routes/route.constants';

type AiRequestPanelProps = {
  projectId: string;
  /** The task or sprint the suggestions are about. */
  subjectId: string;
  /** Which suggestions can be asked for here. */
  kinds: readonly AiRequestKind[];
  /** The viewer's roles on the project — capability hints only. */
  roles: readonly Role[];
  members: readonly MemberCandidate[];
  /** Shown under the request buttons, e.g. who an assignment chooses among. */
  children?: ReactNode;
};

type RequestedCardProps = {
  recommendationId: string;
  members: readonly MemberCandidate[];
  canDecide: boolean;
};

/* Read from the cache, so a decision on it shows the moment it is made. */
function RequestedCard({
  recommendationId,
  members,
  canDecide,
}: RequestedCardProps) {
  const recommendation = useAiRecommendation(recommendationId);
  if (!recommendation) return null;

  return (
    <RecommendationCard
      recommendation={recommendation}
      personName={(id) =>
        members.find((member) => member.id === id)?.name ?? null
      }
    >
      <RecommendationDecision
        recommendation={recommendation}
        members={members}
        canDecide={canDecide}
      />
    </RecommendationCard>
  );
}

/**
 * Asks the AI service for suggestions about one task or sprint, and shows
 * what came back.
 *
 * A request changes nothing: it stores a suggestion for someone to decide on.
 * The service can take several seconds, so the wait is said in words as well
 * as shown on the button. If the service does not answer, that is explained as
 * the service's problem — nothing was saved, and asking again is one press.
 */
export function AiRequestPanel({
  projectId,
  subjectId,
  kinds,
  roles,
  members,
  children,
}: AiRequestPanelProps) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const { request, pendingKind } = useAiRequests(projectId);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [unavailableKind, setUnavailableKind] = useState<AiRequestKind | null>(
    null,
  );

  // Hints only: the server refuses each action to anyone else.
  const { canRequest, canDecide } = aiCapabilities(roles);

  async function handleRequest(kind: AiRequestKind) {
    setUnavailableKind(null);

    try {
      const id = await request(kind, subjectId);
      // Newest first, as the project's own list has them.
      if (id) setRequestedIds((current) => [id, ...current]);
    } catch (error) {
      if (ApiError.is(error) && error.kind === 'service_unavailable') {
        setUnavailableKind(kind);
        return;
      }
      showError(error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-subtle text-sm">{t('ai.request.explainer')}</p>

      {canRequest ? (
        <div className="flex flex-wrap gap-2">
          {kinds.map((kind) => (
            <Button
              key={kind}
              variant="outline"
              size="sm"
              loading={pendingKind === kind}
              disabled={pendingKind !== null && pendingKind !== kind}
              onClick={() => void handleRequest(kind)}
            >
              {t(`ai.request.${kind}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {pendingKind ? (
        <p className="text-text-subtle text-sm" role="status">
          {t('ai.request.waiting')}
        </p>
      ) : null}

      {unavailableKind ? (
        <Alert
          tone="neutral"
          role="alert"
          title={t('ai.request.unavailableTitle')}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRequest(unavailableKind)}
            >
              {t('common.retry')}
            </Button>
          }
        >
          {t('ai.request.unavailableBody')}
        </Alert>
      ) : null}

      {children}

      {requestedIds.length > 0 ? (
        <ul className="divide-border-subtle flex flex-col divide-y">
          {requestedIds.map((id) => (
            <li key={id} className="py-4 first:pt-0 last:pb-0">
              <RequestedCard
                recommendationId={id}
                members={members}
                canDecide={canDecide}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-sm">
        <AppLink to={projectAiPath(projectId)} variant="subtle">
          {t('ai.request.seeAll')}
        </AppLink>
      </p>
    </div>
  );
}
