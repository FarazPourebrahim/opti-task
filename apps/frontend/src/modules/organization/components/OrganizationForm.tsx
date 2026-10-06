import { Button, Input, Textarea } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { organizationSchema } from '@/modules/organization/schemas/organization.schema';
import type { OrganizationInput } from '@/modules/organization/schemas/organization.schema';
import { FormError, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { toFieldErrors } from '@/shared/utils/form.utils';

type OrganizationFormProps = {
  initialValues?: {
    name: string;
    description: string | null | undefined;
    logoUrl: string | null | undefined;
  };
  submitLabel: string;
  isPending: boolean;
  /** Rejects with the failure; the form turns it into a form-level error. */
  onSubmit: (input: OrganizationInput) => Promise<void>;
};

/** The create and the edit form: an organisation's name, description and logo. */
export function OrganizationForm({
  initialValues,
  submitLabel,
  isPending,
  onSubmit,
}: OrganizationFormProps) {
  const { t } = useTranslation();

  const [name, setName] = useState(initialValues?.name ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [logoUrl, setLogoUrl] = useState(initialValues?.logoUrl ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = organizationSchema.safeParse({ name, description, logoUrl });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await onSubmit(parsed.data);
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

      <FormField label={t('organization.name')} error={errorFor('name')}>
        <Input
          name="name"
          autoComplete="organization"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <FormField
        label={t('organization.description')}
        hint={t('common.optional')}
        error={errorFor('description')}
      >
        <Textarea
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isPending}
        />
      </FormField>

      <FormField
        label={t('organization.logoUrl')}
        hint={t('organization.logoUrlHint')}
        error={errorFor('logoUrl')}
      >
        <Input
          type="url"
          name="logoUrl"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
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
