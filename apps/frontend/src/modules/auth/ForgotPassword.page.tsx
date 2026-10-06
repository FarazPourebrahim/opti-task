import { Alert, Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { ROUTES } from '@/shared/routes/route.constants';

/**
 * Password reset is **not implemented on the server**.
 *
 * `requestPasswordReset` validates the email and returns success, but issues no
 * token and sends no mail (see the backend's known-debt). So this screen states
 * that plainly instead of collecting an address and implying a message is on
 * its way — a form that silently does nothing is worse than no form, because
 * the user waits for an email that will never arrive.
 *
 * When the backend grows a real reset-token table, this becomes a normal form
 * and the mutation is already wired in `auth.operations.ts`.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.loginSubtitle')}
    >
      <Alert
        tone="neutral"
        role="status"
        title={t('auth.forgot.unavailableTitle')}
      >
        {t('auth.forgot.unavailableBody')}
      </Alert>

      <Button asChild variant="outline" block>
        <RouterLink to={ROUTES.login}>
          {t('auth.forgot.backToSignIn')}
        </RouterLink>
      </Button>
    </AuthLayout>
  );
}
