import { Button, Input, useToast } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { SENIORITY_LEVELS } from '@contracts';
import type { SeniorityLevel } from '@contracts';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useUpdateProfile } from '@/modules/user/hooks/useProfile';
import { profileSchema } from '@/modules/user/schemas/user.schema';
import { FormError, FormField, SelectField } from '@/shared/components';
import type { SelectOption } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

const NOT_SET = 'NOT_SET';
type SeniorityChoice = SeniorityLevel | typeof NOT_SET;

type ProfileFormProps = {
  profile: {
    name: string;
    email: string;
    avatarUrl?: string | null | undefined;
    seniority?: SeniorityLevel | null | undefined;
  };
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const { updateProfile, isUpdating } = useUpdateProfile();

  const [name, setName] = useState(profile.name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  const [seniority, setSeniority] = useState<SeniorityChoice>(
    profile.seniority ?? NOT_SET,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const seniorityOptions: Array<SelectOption<SeniorityChoice>> = [
    { value: NOT_SET, label: t('user.seniorityNotSet') },
    ...SENIORITY_LEVELS.map((level) => ({
      value: level,
      label: t(`enums.seniority.${level}`),
    })),
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = profileSchema.safeParse({
      name,
      avatarUrl,
      seniority: seniority === NOT_SET ? null : seniority,
    });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await updateProfile(parsed.data);
      toast({ tone: 'success', title: t('user.profileUpdated') });
      // The shell's avatar and name come from the session, not this query.
      void refreshUser();
    } catch (error) {
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

      <FormField label={t('auth.name')} error={errorFor('name')}>
        <Input
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isUpdating}
        />
      </FormField>

      {/* The API has no operation to change an email address. */}
      <FormField label={t('auth.email')} hint={t('user.emailReadOnly')}>
        <Input type="email" value={profile.email} readOnly />
      </FormField>

      <FormField
        label={t('user.avatarUrl')}
        hint={t('user.avatarUrlHint')}
        error={errorFor('avatarUrl')}
      >
        <Input
          type="url"
          name="avatarUrl"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          disabled={isUpdating}
        />
      </FormField>

      <SelectField
        label={t('user.seniority')}
        value={seniority}
        onValueChange={setSeniority}
        options={seniorityOptions}
        disabled={isUpdating}
      />

      <div className="flex justify-end">
        <Button type="submit" loading={isUpdating}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
