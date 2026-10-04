import { Button, Input, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { AVAILABILITY_STATUSES, TEAM_ROLES } from '@contracts';
import type { AvailabilityStatus, TeamRole } from '@contracts';
import type { MemberCandidate } from '@/modules/project/hooks/useProjectContext';
import { teamMemberSchema } from '@/modules/team/schemas/team.schema';
import type { TeamMemberInput } from '@/modules/team/schemas/team.schema';
import {
  FormError,
  FormField,
  MemberPicker,
  SelectField,
} from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type TeamMemberFormProps = {
  /**
   * Who can be added — project members not yet on the team. Omitted when
   * editing an existing member, whose identity is fixed.
   */
  candidates?: readonly MemberCandidate[];
  initialValues?: {
    role: TeamRole;
    responsibilities?: string | null | undefined;
    availability: AvailabilityStatus;
    workload: number;
  };
  submitLabel: string;
  isPending: boolean;
  /** `userId` is the picked candidate when adding, and empty when editing. */
  onSubmit: (userId: string, input: TeamMemberInput) => Promise<void>;
};

/**
 * A team member's role, responsibilities, availability and workload — the
 * attributes the AI assignment engine reads when it suggests an assignee.
 */
export function TeamMemberForm({
  candidates,
  initialValues,
  submitLabel,
  isPending,
  onSubmit,
}: TeamMemberFormProps) {
  const { t } = useTranslation();
  const isAdding = candidates !== undefined;

  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<TeamRole>(initialValues?.role ?? 'MEMBER');
  const [responsibilities, setResponsibilities] = useState(
    initialValues?.responsibilities ?? '',
  );
  const [availability, setAvailability] = useState<AvailabilityStatus>(
    initialValues?.availability ?? 'AVAILABLE',
  );
  const [workload, setWorkload] = useState(
    String(initialValues?.workload ?? 0),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = teamMemberSchema.safeParse({
      role,
      responsibilities,
      availability,
      // An empty or non-numeric field becomes NaN, which the schema rejects.
      workload: workload.trim() === '' ? NaN : Number(workload),
    });
    const errors = parsed.success ? {} : toFieldErrors(parsed.error);
    if (isAdding && !userId)
      errors['userId'] = 'team.validation.memberRequired';

    if (!parsed.success || Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    try {
      await onSubmit(userId, parsed.data);
      setUserId('');
    } catch (error) {
      if (ApiError.is(error) && error.kind === 'conflict') {
        setFormError(t('team.memberConflict'));
        return;
      }
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  function errorFor(field: string): string | undefined {
    const key = fieldErrors[field];
    return key ? t(key as never) : undefined;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      {isAdding ? (
        <MemberPicker
          label={t('team.memberPickerLabel')}
          hint={t('team.memberPickerHint')}
          candidates={candidates}
          value={userId}
          onValueChange={setUserId}
          disabled={isPending}
          error={errorFor('userId')}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={t('team.memberRole')}
          value={role}
          onValueChange={setRole}
          disabled={isPending}
          options={TEAM_ROLES.map((option) => ({
            value: option,
            label: t(`enums.teamRole.${option}`),
          }))}
        />
        <SelectField
          label={t('team.memberAvailability')}
          value={availability}
          onValueChange={setAvailability}
          disabled={isPending}
          options={AVAILABILITY_STATUSES.map((option) => ({
            value: option,
            label: t(`enums.availability.${option}`),
          }))}
        />
        <FormField
          label={t('team.memberWorkload')}
          hint={t('team.memberWorkloadHint')}
          error={errorFor('workload')}
        >
          <Input
            type="number"
            name="workload"
            inputMode="numeric"
            min={0}
            max={1000}
            step={1}
            value={workload}
            onChange={(event) => setWorkload(event.target.value)}
            disabled={isPending}
          />
        </FormField>
      </div>

      <FormField
        label={t('team.memberResponsibilities')}
        hint={t('common.optional')}
        error={errorFor('responsibilities')}
      >
        <Textarea
          name="responsibilities"
          rows={2}
          value={responsibilities}
          onChange={(event) => setResponsibilities(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
