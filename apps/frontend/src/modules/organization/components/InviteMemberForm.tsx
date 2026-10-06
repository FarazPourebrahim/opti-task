import { Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import {
  ASSIGNABLE_ORG_ROLES,
  inviteSchema,
} from '@/modules/organization/schemas/organization.schema';
import type {
  AssignableOrgRole,
  InviteInput,
} from '@/modules/organization/schemas/organization.schema';
import { FormError, FormField, SelectField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type InviteMemberFormProps = {
  isPending: boolean;
  /** Rejects with the failure; the form explains it. */
  onInvite: (input: InviteInput) => Promise<void>;
};

export function InviteMemberForm({
  isPending,
  onInvite,
}: InviteMemberFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableOrgRole>('MEMBER');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await onInvite(parsed.data);
      setEmail('');
    } catch (error) {
      setFormError(messageFor(error));
    }
  }

  function messageFor(error: unknown): string {
    if (!ApiError.is(error)) return t('error.unknown');

    // The server refuses a second invitation to the same address, and one to
    // someone who is already a member; both arrive as the same code.
    if (error.kind === 'conflict') return t('organization.inviteConflict');

    return t(error.messageKey as never);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormError message={formError} />

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <FormField
          label={t('organization.inviteEmail')}
          error={
            fieldErrors['email'] ? t(fieldErrors['email'] as never) : undefined
          }
        >
          <Input
            type="email"
            name="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
          />
        </FormField>

        <SelectField
          label={t('organization.inviteRole')}
          value={role}
          onValueChange={setRole}
          disabled={isPending}
          options={ASSIGNABLE_ORG_ROLES.map((option) => ({
            value: option,
            label: t(`enums.orgRole.${option}`),
          }))}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {t('organization.inviteSubmit')}
        </Button>
      </div>
    </form>
  );
}
