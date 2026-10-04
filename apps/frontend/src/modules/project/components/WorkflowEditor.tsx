import { Alert, Button, Textarea, useToast } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { parseWorkflow } from '@/modules/project/utils/project.utils';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';

type WorkflowEditorProps = {
  workflow: Record<string, unknown>;
  isPending: boolean;
  /** Rejects with the failure; the editor explains it. */
  onSave: (workflow: Record<string, unknown>) => Promise<void>;
};

/**
 * A raw JSON editor for the project's workflow configuration.
 *
 * It is deliberately raw. The server stores any JSON object and checks nothing
 * about its shape, and nothing reads it yet — task statuses follow a fixed
 * flow. A structured editor would imply a contract that does not exist, so
 * this says what it is.
 */
export function WorkflowEditor({
  workflow,
  isPending,
  onSave,
}: WorkflowEditorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [text, setText] = useState(() => JSON.stringify(workflow, null, 2));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = parseWorkflow(text);
    if (!parsed.ok) {
      setFieldError(t('project.workflowInvalid'));
      return;
    }
    setFieldError(null);

    try {
      await onSave(parsed.value);
      toast({ tone: 'success', title: t('project.workflowSaved') });
    } catch (error) {
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <Alert tone="info" title={t('project.workflowNoticeTitle')}>
        {t('project.workflowNoticeBody')}
      </Alert>

      <FormError message={formError} />

      <FormField
        label={t('project.workflowLabel')}
        error={fieldError ?? undefined}
      >
        <Textarea
          name="workflow"
          rows={10}
          resize="vertical"
          spellCheck={false}
          className="font-code text-sm"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {t('project.workflowSave')}
        </Button>
      </div>
    </form>
  );
}
