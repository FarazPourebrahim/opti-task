import { Card, EmptyState } from '@averoui/react';
import { SearchX, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AI_APPROVAL_STATUSES, AI_RECOMMENDATION_TYPES } from '@contracts';
import type { AiApprovalStatus, AiRecommendationType } from '@contracts';
import { RecommendationCard } from '@/modules/ai/components/RecommendationCard';
import { RecommendationDecision } from '@/modules/ai/components/RecommendationDecision';
import { AI_FILTER_ANY } from '@/modules/ai/constants/ai.constants';
import { useProjectAiRecommendations } from '@/modules/ai/hooks/useAiRecommendations';
import { aiCapabilities } from '@/modules/ai/utils/ai.utils';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import {
  ErrorState,
  LoadMore,
  PageSkeleton,
  SelectField,
} from '@/shared/components';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';

type Any = typeof AI_FILTER_ANY;

/**
 * Every AI recommendation made in the project, newest first: what was
 * suggested, how sure the provider was, and what a person decided.
 *
 * Suggestions are asked for from a task or a sprint; this is where they are
 * reviewed together.
 */
export function AiRecommendationsPage() {
  const { t } = useTranslation();
  const { project, roles, members } = useProjectContext();
  const [type, setType] = useState<AiRecommendationType | Any>(AI_FILTER_ANY);
  const [approvalStatus, setApprovalStatus] = useState<AiApprovalStatus | Any>(
    AI_FILTER_ANY,
  );
  const isFiltered = type !== AI_FILTER_ANY || approvalStatus !== AI_FILTER_ANY;

  const {
    recommendations,
    totalCount,
    isLoading,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useProjectAiRecommendations(project.id, {
    type: type === AI_FILTER_ANY ? null : type,
    approvalStatus: approvalStatus === AI_FILTER_ANY ? null : approvalStatus,
  });

  useEscalateRouteError(error);

  const candidates = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [members],
  );
  const personName = useCallback(
    (id: string) =>
      candidates.find((candidate) => candidate.id === id)?.name ?? null,
    [candidates],
  );

  // A hint only: the server refuses a decision to anyone else.
  const { canDecide } = aiCapabilities(roles);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-text-strong text-xl font-bold">{t('ai.title')}</h2>
        <p className="text-text-subtle text-sm">{t('ai.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('ai.filter.type')}
          value={type}
          onValueChange={setType}
          options={[
            { value: AI_FILTER_ANY, label: t('ai.filter.anyType') },
            ...AI_RECOMMENDATION_TYPES.map((value) => ({
              value,
              label: t(`enums.aiRecommendationType.${value}`),
            })),
          ]}
        />
        <SelectField
          label={t('ai.filter.decision')}
          value={approvalStatus}
          onValueChange={setApprovalStatus}
          options={[
            { value: AI_FILTER_ANY, label: t('ai.filter.anyDecision') },
            ...AI_APPROVAL_STATUSES.map((value) => ({
              value,
              label: t(`enums.aiApprovalStatus.${value}`),
            })),
          ]}
        />
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('ai.loadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : recommendations.length === 0 ? (
        <Card>
          {isFiltered ? (
            <EmptyState variant="circle" icon={<SearchX />}>
              {t('ai.emptyFiltered')}
            </EmptyState>
          ) : (
            <EmptyState variant="circle" icon={<Sparkles />}>
              {t('ai.empty')}
            </EmptyState>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-4">
            {recommendations.map((recommendation) => (
              <li key={recommendation.id}>
                <Card>
                  <RecommendationCard
                    recommendation={recommendation}
                    personName={personName}
                    headingLevel={3}
                  >
                    <RecommendationDecision
                      recommendation={recommendation}
                      members={candidates}
                      canDecide={canDecide}
                    />
                  </RecommendationCard>
                </Card>
              </li>
            ))}
          </ul>
          <LoadMore
            shown={recommendations.length}
            total={totalCount}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        </div>
      )}
    </section>
  );
}
