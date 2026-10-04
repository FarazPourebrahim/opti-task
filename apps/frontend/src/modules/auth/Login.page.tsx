import { Button, Input } from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { FormError } from '@/modules/auth/components/FormError';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { loginSchema, toFieldErrors } from '@/modules/auth/schemas/auth.schema';
import { LinkButton } from '@/modules/auth/components/LinkButton';
import { FormField } from '@/shared/components';
import { ApiError } from '@/shared/lib/apiError';

type LoginPageProps = {
  /** Phase 5 supplies real navigation; until then the caller decides. */
  onSignedIn?: () => void;
  onGoToRegister?: () => void;
  onGoToForgotPassword?: () => void;
};

export function LoginPage({
  onSignedIn,
  onGoToRegister,
  onGoToForgotPassword,
}: LoginPageProps) {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setIsPending(true);

    try {
      await login(parsed.data);
      onSignedIn?.();
    } catch (error) {
      setFormError(messageFor(error));
    } finally {
      setIsPending(false);
    }
  }

  function messageFor(error: unknown): string {
    if (!ApiError.is(error)) return t('error.unknown');

    /*
     * A wrong password and an unknown email are deliberately the same message.
     * Distinguishing them would let anyone test whether an address has an
     * account here.
     */
    if (error.kind === 'unauthorized' || error.kind === 'validation') {
      return t('auth.invalidCredentials');
    }

    return t(error.messageKey as never);
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          <span>{t('auth.noAccount')}</span>
          <LinkButton onClick={onGoToRegister}>
            {t('auth.createAccount')}
          </LinkButton>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FormError message={formError} />

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
          error={
            fieldErrors['password']
              ? t(fieldErrors['password'] as never)
              : undefined
          }
        >
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
          />
        </FormField>

        <Button type="submit" loading={isPending} block size="lg">
          {isPending ? t('auth.signingIn') : t('auth.signIn')}
        </Button>

        <LinkButton onClick={onGoToForgotPassword}>
          {t('auth.forgotPassword')}
        </LinkButton>
      </form>
    </AuthLayout>
  );
}
