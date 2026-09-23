import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { Button } from '@/shared/components';
import styles from './Auth.page.module.css';

type ForgotPasswordPageProps = {
  onGoToLogin?: () => void;
};

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
export function ForgotPasswordPage({ onGoToLogin }: ForgotPasswordPageProps) {
  const { t } = useTranslation();

  return (
    <AuthLayout
      title={t('auth.forgot.title')}
      subtitle={t('auth.loginSubtitle')}
    >
      <div className={styles.notice} role="status">
        <p className={styles.noticeTitle}>{t('auth.forgot.unavailableTitle')}</p>
        <p className={styles.noticeBody}>{t('auth.forgot.unavailableBody')}</p>
      </div>

      <Button variant="secondary" fullWidth onClick={onGoToLogin}>
        {t('auth.forgot.backToSignIn')}
      </Button>
    </AuthLayout>
  );
}
