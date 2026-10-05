import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OverrideForm } from '@/modules/ai/components/OverrideForm';
import { useAiDecisions } from '@/modules/ai/hooks/useAiRecommendations';
import type { AiRecommendationData } from '@/modules/ai/hooks/useAiRecommendations';
import type { OverrideInput } from '@/modules/ai/schemas/ai.schema';
import { readSuggestion } from '@/modules/ai/utils/ai.utils';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { ApiError } from '@/shared/lib/apiError';

type RecommendationDecisionProps = {
  recommendation: AiRecommendationData;
  /** Project members, for naming a suggested person and offering another. */
  members: readonly MemberCandidate[];
  /** A hint, not a guard: whether the viewer may decide. */
  canDecide: boolean;
};

/**
 * Approve, reject or override a pending suggestion.
 *
 * Approving never happens on one click: a dialog first says, in a sentence,
 * exactly what it will change — or, for a sprint insight, that it changes
 * nothing. Someone who may request suggestions but not decide on them sees
 * nothing here, and a decision already made leaves nothing to offer.
 */
export function RecommendationDecision({
  recommendation,
  members,
  canDecide,
}: RecommendationDecisionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const {
    approveRecommendation,
    rejectRecommendation,
    overrideRecommendation,
    isDeciding,
  } = useAiDecisions(recommendation.projectId);
  const [isConfirmingApprove, setIsConfirmingApprove] = useState(false);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);

  if (!canDecide || recommendation.approvalStatus !== 'PENDING') return null;

  const suggestion = readSuggestion(recommendation);

  /** What approving will do, said before it is done. */
  function approvalEffect(): string {
    if (suggestion.kind === 'storyPoints') {
      return suggestion.storyPoints === null
        ? t('ai.approve.effectNoEstimate')
        : t('ai.approve.effectStoryPoints', { count: suggestion.storyPoints });
    }

    if (suggestion.kind === 'assignee') {
      if (suggestion.assigneeId === null) {
        return t('ai.approve.effectNoAssignee');
      }

      const name = members.find(
        (member) => member.id === suggestion.assigneeId,
      )?.name;
      return name
        ? t('ai.approve.effectAssignee', { name })
        : t('ai.approve.effectUnknownAssignee');
    }

    return t('ai.approve.effectInsight');
  }

  /*
   * Someone else decided first. The hook has already re-read the
   * recommendation, so the card shows how it now stands; this says why the
   * viewer's own decision did not take.
   */
  function explain(error: unknown) {
    if (ApiError.is(error) && error.kind === 'conflict') {
      toast({ tone: 'danger', title: t('ai.alreadyDecided') });
      return;
    }
    showError(error);
  }

  /* Never rejects: ConfirmDialog stays open until this settles. */
  async function handleApprove() {
    try {
      await approveRecommendation(recommendation);
      toast({ tone: 'success', title: t('ai.approve.done') });
    } catch (error) {
      explain(error);
    } finally {
      setIsConfirmingApprove(false);
    }
  }

  async function handleReject() {
    try {
      await rejectRecommendation(recommendation);
      toast({ tone: 'success', title: t('ai.reject.done') });
    } catch (error) {
      explain(error);
    }
  }

  async function handleOverride(input: OverrideInput) {
    try {
      await overrideRecommendation(recommendation, input);
    } catch (error) {
      // A decision already made cannot be fixed in this form: close it.
      if (ApiError.is(error) && error.kind === 'conflict') {
        setIsOverrideOpen(false);
        explain(error);
        return;
      }
      throw error;
    }
    toast({ tone: 'success', title: t('ai.override.done') });
    setIsOverrideOpen(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={isDeciding}
        onClick={() => setIsConfirmingApprove(true)}
      >
        {t('ai.approve.action')}
      </Button>
      {suggestion.kind === 'insight' ? null : (
        <Button
          size="sm"
          variant="outline"
          disabled={isDeciding}
          onClick={() => setIsOverrideOpen(true)}
        >
          {t('ai.override.action')}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        loading={isDeciding && !isConfirmingApprove && !isOverrideOpen}
        onClick={() => void handleReject()}
      >
        {t('ai.reject.action')}
      </Button>

      <ConfirmDialog
        open={isConfirmingApprove}
        onOpenChange={setIsConfirmingApprove}
        title={t('ai.approve.confirmTitle')}
        description={approvalEffect()}
        confirmLabel={t('ai.approve.action')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleApprove}
      />

      {suggestion.kind === 'insight' ? null : (
        <Dialog open={isOverrideOpen} onOpenChange={setIsOverrideOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{t('ai.override.title')}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <OverrideForm
                kind={suggestion.kind}
                members={members}
                isPending={isDeciding}
                onSubmit={handleOverride}
                onCancel={() => setIsOverrideOpen(false)}
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
