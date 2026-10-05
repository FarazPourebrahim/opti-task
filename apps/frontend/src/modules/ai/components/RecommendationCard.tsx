import { Badge, Progress } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  AI_APPROVAL_TONES,
  AI_RESOLUTION_TONES,
  AI_TYPE_ICONS,
} from '@/modules/ai/constants/ai.constants';
import type { AiRecommendationData } from '@/modules/ai/hooks/useAiRecommendations';
import { confidencePercent, readSuggestion } from '@/modules/ai/utils/ai.utils';
import type { AiSuggestion } from '@/modules/ai/utils/ai.utils';
import { AppLink } from '@/shared/components';
import { sprintPath, taskPath } from '@/shared/routes/route.constants';
import { formatRelativeTime } from '@/shared/utils/date.utils';

type RecommendationCardProps = {
  recommendation: AiRecommendationData;
  /** Names a person from their id, or null when they are not known here. */
  personName: (id: string) => string | null;
  /**
   * The level of the card's own heading: one below whatever heads the place
   * it is shown in, so the page's outline has no gap. Defaults to 4, for a
   * card inside a titled panel.
   */
  headingLevel?: 3 | 4;
  /** The controls for deciding on it, when the viewer is offered them. */
  children?: ReactNode;
};

/**
 * One AI recommendation, presented as what it is: a suggestion.
 *
 * It is never shown without how sure the provider said it was, who the
 * provider is, and when it was made. What a person decided and what became of
 * the suggestion are two separate facts, each with its own labelled badge.
 */
export function RecommendationCard({
  recommendation,
  personName,
  headingLevel = 4,
  children,
}: RecommendationCardProps) {
  const { t } = useTranslation();
  const Icon = AI_TYPE_ICONS[recommendation.type];
  const suggestion = readSuggestion(recommendation);
  const confidence = confidencePercent(recommendation.confidenceScore);
  const typeName = t(`enums.aiRecommendationType.${recommendation.type}`);
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const SubHeading = headingLevel === 3 ? 'h4' : 'h5';

  function describe(proposal: AiSuggestion): string {
    if (proposal.kind === 'storyPoints') {
      return proposal.storyPoints === null
        ? t('ai.suggests.noEstimate')
        : t('ai.suggests.storyPoints', { count: proposal.storyPoints });
    }

    if (proposal.kind === 'assignee') {
      if (proposal.assigneeId === null) return t('ai.suggests.noAssignee');

      const name = personName(proposal.assigneeId);
      return name
        ? t('ai.suggests.assignee', { name })
        : t('ai.suggests.unknownAssignee');
    }

    return t('ai.suggests.insight');
  }

  return (
    <article
      className="flex flex-col gap-3"
      aria-label={t('ai.cardLabel', { type: typeName })}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading className="text-text-strong flex items-center gap-2 text-sm font-semibold">
          <Icon aria-hidden className="text-text-subtle size-4 shrink-0" />
          {typeName}
        </Heading>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-text-subtle">{t('ai.decision')}</dt>
            <dd>
              <Badge tone={AI_APPROVAL_TONES[recommendation.approvalStatus]}>
                {t(`enums.aiApprovalStatus.${recommendation.approvalStatus}`)}
              </Badge>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-text-subtle">{t('ai.outcome')}</dt>
            <dd>
              <Badge
                tone={AI_RESOLUTION_TONES[recommendation.resolutionStatus]}
              >
                {t(
                  `enums.aiResolutionStatus.${recommendation.resolutionStatus}`,
                )}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-text-strong text-sm font-medium">
        {describe(suggestion)}
      </p>

      {/* The provider's own words, as plain text. */}
      <p className="text-sm break-words whitespace-pre-wrap">
        {recommendation.text}
      </p>

      {suggestion.kind === 'insight' ? (
        suggestion.risks.length > 0 ? (
          <div className="flex flex-col gap-1">
            <SubHeading className="text-text-subtle text-xs font-medium">
              {t('ai.risksTitle')}
            </SubHeading>
            <ul className="list-disc ps-5 text-sm">
              {suggestion.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-text-subtle text-sm">{t('ai.noRisks')}</p>
        )
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="flex items-center justify-between gap-3 text-xs">
          <span className="text-text-subtle">{t('ai.confidence')}</span>
          <span className="text-text-strong font-semibold tabular-nums">
            {confidence === null
              ? t('ai.confidenceUnknown')
              : t('ai.confidenceValue', { value: confidence })}
          </span>
        </p>
        {confidence === null ? null : (
          <Progress
            size="sm"
            value={confidence}
            aria-label={t('ai.confidenceOf', { value: confidence })}
          />
        )}
      </div>

      <p className="text-text-subtle flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span>
          {t('ai.provider', {
            provider: recommendation.provider ?? t('ai.providerUnknown'),
          })}
        </span>
        <span>
          {recommendation.requestedBy
            ? t('ai.requestedBy', { name: recommendation.requestedBy.name })
            : t('ai.requestedByUnknown')}
        </span>
        <time dateTime={recommendation.createdAt}>
          {formatRelativeTime(recommendation.createdAt)}
        </time>
        {recommendation.approvedBy ? (
          <span>
            {t('ai.decidedBy', { name: recommendation.approvedBy.name })}
          </span>
        ) : null}
      </p>

      {recommendation.taskId ? (
        <p className="text-sm">
          <AppLink
            to={taskPath(recommendation.projectId, recommendation.taskId)}
            variant="subtle"
          >
            {t('ai.openTask')}
          </AppLink>
        </p>
      ) : recommendation.sprintId ? (
        <p className="text-sm">
          <AppLink
            to={sprintPath(recommendation.projectId, recommendation.sprintId)}
            variant="subtle"
          >
            {t('ai.openSprint')}
          </AppLink>
        </p>
      ) : null}

      {children}
    </article>
  );
}
