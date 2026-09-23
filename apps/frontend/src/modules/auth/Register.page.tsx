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
import { Button, Field, Input } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';
import styles from './Auth.page.module.css';

type RegisterPageProps = {
  onSignedIn?: () => void;
  onGoToLogin?: () => void;
};

export function RegisterPage({ onSignedIn, onGoToLogin }: RegisterPageProps) {
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
      await register(parsed.data);
      onSignedIn?.();
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
          <button
            type="button"
            className={styles.linkButton}
            onClick={onGoToLogin}
          >
            {t('auth.signIn')}
          </button>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <FormError message={formError} />

        <Field
          label={t('auth.name')}
          error={fieldErrors['name'] ? t(fieldErrors['name'] as never) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
            />
          )}
        </Field>

        <Field
          label={t('auth.email')}
          error={fieldErrors['email'] ? t(fieldErrors['email'] as never) : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
            />
          )}
        </Field>

        <Field
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          error={
            fieldErrors['password']
              ? t(fieldErrors['password'] as never)
              : undefined
          }
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
            />
          )}
        </Field>

        <Button type="submit" isLoading={isPending} fullWidth size="lg">
          {isPending ? t('auth.creatingAccount') : t('auth.createAccount')}
        </Button>
      </form>
    </AuthLayout>
  );
}
