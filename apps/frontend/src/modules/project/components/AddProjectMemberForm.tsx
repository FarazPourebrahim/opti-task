import { Alert, Button } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { PROJECT_ROLES } from '@contracts';
import type { ProjectRole } from '@contracts';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { addProjectMemberSchema } from '@/modules/project/schemas/project.schema';
import { FormError, MemberPicker, SelectField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type AddProjectMemberFormProps = {
  /** Organisation members who are not on the project yet. */
  candidates: readonly MemberCandidate[];
  isPending: boolean;
  /** Rejects with the failure; the form explains it. */
  onAdd: (candidate: MemberCandidate, role: ProjectRole) => Promise<void>;
};

export function AddProjectMemberForm({
  candidates,
  isPending,
  onAdd,
}: AddProjectMemberFormProps) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <Alert tone="neutral" title={t('project.noCandidatesTitle')}>
        {t('project.noCandidatesBody')}
      </Alert>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = addProjectMemberSchema.safeParse({ userId, role });
    const candidate = candidates.find((option) => option.id === userId);
    if (!parsed.success || !candidate) {
      setFieldErrors(
        parsed.success
          ? { userId: 'project.validation.memberRequired' }
          : toFieldErrors(parsed.error),
      );
      return;
    }
    setFieldErrors({});

    try {
      await onAdd(candidate, parsed.data.role);
      setUserId('');
    } catch (error) {
      if (ApiError.is(error) && error.kind === 'conflict') {
        setFormError(t('project.memberConflict'));
        return;
      }
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <MemberPicker
          label={t('project.memberPickerLabel')}
          hint={t('project.memberPickerHint')}
          candidates={candidates}
          value={userId}
          onValueChange={setUserId}
          disabled={isPending}
          error={
            fieldErrors['userId']
              ? t(fieldErrors['userId'] as never)
              : undefined
          }
        />
        <SelectField
          label={t('project.memberRole')}
          value={role}
          onValueChange={setRole}
          disabled={isPending}
          options={PROJECT_ROLES.map((option) => ({
            value: option,
            label: t(`enums.projectRole.${option}`),
          }))}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {t('project.memberAdd')}
        </Button>
      </div>
    </form>
  );
}
