import { Button, EmptyState, Input, Progress } from '@averoui/react';
import { GraduationCap, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { useExpertise } from '@/modules/user/hooks/useProfile';
import {
  expertiseSchema,
  toConfidencePercent,
  toConfidenceScore,
} from '@/modules/user/schemas/user.schema';
import { FormField } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { toFieldErrors } from '@/shared/utils/form.utils';

type ExpertiseEditorProps = {
  expertise: ReadonlyArray<{
    id: string;
    tag: string;
    confidenceScore: number;
  }>;
};

const DEFAULT_CONFIDENCE_PERCENT = '50';

/**
 * Expertise tags with a self-assessed confidence. These feed the AI assignment
 * engine, so the confidence is shown as plainly as the tag.
 */
export function ExpertiseEditor({ expertise }: ExpertiseEditorProps) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const { addExpertise, removeExpertise, isAdding, isRemoving } =
    useExpertise();
  const [tag, setTag] = useState('');
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE_PERCENT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = expertiseSchema.safeParse({
      tag,
      // An empty or non-numeric field becomes NaN, which the schema rejects.
      confidencePercent: confidence.trim() === '' ? NaN : Number(confidence),
    });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await addExpertise(
        parsed.data.tag,
        toConfidenceScore(parsed.data.confidencePercent),
      );
      setTag('');
      setConfidence(DEFAULT_CONFIDENCE_PERCENT);
    } catch (error) {
      showError(error);
    }
  }

  async function handleRemove(expertiseTag: string) {
    try {
      await removeExpertise(expertiseTag);
    } catch (error) {
      showError(error);
    }
  }

  function errorFor(field: string): string | undefined {
    const key = fieldErrors[field];
    return key ? t(key as never) : undefined;
  }

  return (
    <div className="flex flex-col gap-4">
      {expertise.length === 0 ? (
        <EmptyState variant="circle" icon={<GraduationCap />}>
          {t('user.expertiseEmpty')}
        </EmptyState>
      ) : (
        <ul
          aria-label={t('user.expertiseTitle')}
          className="divide-border-subtle flex flex-col divide-y"
        >
          {expertise.map((item) => {
            const percent = toConfidencePercent(item.confidenceScore);

            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-text-strong min-w-32 flex-1 text-sm font-medium">
                  {item.tag}
                </span>
                <Progress
                  value={percent}
                  aria-label={t('user.expertiseConfidenceFor', {
                    tag: item.tag,
                  })}
                  className="w-32"
                />
                <span className="text-text-subtle w-12 text-end text-sm tabular-nums">
                  {t('user.percent', { value: percent })}
                </span>
                <button
                  type="button"
                  aria-label={t('user.expertiseRemove', { tag: item.tag })}
                  disabled={isRemoving}
                  onClick={() => void handleRemove(item.tag)}
                  className="text-text-subtle focus-visible:ring-primary/40 cursor-pointer rounded-full p-1.5 hover:bg-black/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="grid items-start gap-3 sm:grid-cols-[1fr_10rem_auto]"
        onSubmit={handleAdd}
        noValidate
      >
        <FormField label={t('user.expertiseTag')} error={errorFor('tag')}>
          <Input
            name="tag"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            disabled={isAdding}
          />
        </FormField>
        <FormField
          label={t('user.expertiseConfidence')}
          error={errorFor('confidencePercent')}
        >
          <Input
            type="number"
            name="confidence"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={confidence}
            onChange={(event) => setConfidence(event.target.value)}
            disabled={isAdding}
          />
        </FormField>
        {/* Lines the button up with the inputs rather than their labels. */}
        <Button
          type="submit"
          variant="outline"
          loading={isAdding}
          className="sm:mt-7"
        >
          {t('user.expertiseAdd')}
        </Button>
      </form>
    </div>
  );
}
