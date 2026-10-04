import { useMutation } from '@apollo/client/react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  useToast,
} from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { ChangePasswordMutation } from '@/modules/auth/graphql/auth.operations';
import { FormError } from '@/modules/auth/components/FormError';
import {
  changePasswordSchema,
  toFieldErrors,
} from '@/modules/auth/schemas/auth.schema';
import { FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';

export function ChangePasswordForm() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [changePassword, { loading }] = useMutation(ChangePasswordMutation);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
    });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    try {
      await changePassword({ variables: { input: parsed.data } });
      toast({ title: t('auth.changePassword.success'), tone: 'success' });
      // Clearing on success stops the old password sitting in the DOM.
      setCurrentPassword('');
      setNewPassword('');
    } catch (error) {
      if (ApiError.is(error) && error.kind === 'unauthorized') {
        setFormError(t('auth.changePassword.wrongCurrent'));
        return;
      }
      setFormError(
        ApiError.is(error) ? t(error.messageKey as never) : t('error.unknown'),
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('auth.changePassword.title')}</CardTitle>
      </CardHeader>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FormError message={formError} />

        <FormField
          label={t('auth.currentPassword')}
          error={
            fieldErrors['currentPassword']
              ? t(fieldErrors['currentPassword'] as never)
              : undefined
          }
        >
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            disabled={loading}
          />
        </FormField>

        <FormField
          label={t('auth.newPassword')}
          hint={t('auth.passwordHint')}
          error={
            fieldErrors['newPassword']
              ? t(fieldErrors['newPassword'] as never)
              : undefined
          }
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={loading}
          />
        </FormField>

        <div className="flex justify-end">
          <Button type="submit" loading={loading}>
            {t('auth.changePassword.submit')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
