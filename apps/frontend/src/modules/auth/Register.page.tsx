import { Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { FormError } from '@/modules/auth/components/FormError';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import {
  registerSchema,
  toFieldErrors,
} from '@/modules/auth/schemas/auth.schema';
import { AppLink, FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import { ROUTES } from '@/shared/routes/route.constants';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setIsPending(true);

    try {
      // The guest guard moves the new user into the app once the session exists.
      await register(parsed.data);
    } catch (error) {
      setFormError(messageFor(error));
    } finally {
      setIsPending(false);
    }
  }

  function messageFor(error: unknown): string {
    if (!ApiError.is(error)) return t('error.unknown');

    // Registration is the one place where "this email is taken" is not an
    // enumeration leak — the person is choosing the address themselves and has
    // to be told why it was refused.
    if (error.kind === 'conflict') return t('auth.emailTaken');
    if (error.kind === 'validation') return t('error.validation');

    return t(error.messageKey as never);
  }

  return (
    <AuthLayout
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <>
          <span>{t('auth.haveAccount')}</span>
          <AppLink to={ROUTES.login}>{t('auth.signIn')}</AppLink>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FormError message={formError} />

        <FormField
          label={t('auth.name')}
          error={
            fieldErrors['name'] ? t(fieldErrors['name'] as never) : undefined
          }
        >
          <Input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
          />
        </FormField>

        <FormField
          label={t('auth.email')}
          error={
            fieldErrors['email'] ? t(fieldErrors['email'] as never) : undefined
          }
        >
          <Input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
          />
        </FormField>

        <FormField
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          error={
            fieldErrors['password']
              ? t(fieldErrors['password'] as never)
              : undefined
          }
        >
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
          />
        </FormField>

        <Button type="submit" loading={isPending} block size="lg">
          {isPending ? t('auth.creatingAccount') : t('auth.createAccount')}
        </Button>
      </form>
    </AuthLayout>
  );
}
