import { useMutation } from '@apollo/client/react';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AcceptInvitationMutation } from '@/modules/auth/graphql/auth.operations';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Button, EmptyState, Spinner } from '@/shared/components';
import styles from './Auth.page.module.css';

type AcceptInvitationPageProps = {
  token: string;
  onAccepted?: () => void;
  onGoToLogin?: () => void;
};

type State =
  | { kind: 'pending' }
  | { kind: 'accepted'; organisation: string }
  | { kind: 'needsSignIn' }
  | { kind: 'invalid' };

/**
 * Redeems an organisation invitation link.
 *
 * Accepting requires a signed-in account — the invitation binds an existing
 * user to an organisation — so an anonymous visitor is asked to sign in first
 * rather than being shown a failure they cannot act on.
 */
export function AcceptInvitationPage({
  token,
  onAccepted,
  onGoToLogin,
}: AcceptInvitationPageProps) {
  const { t } = useTranslation();
  const { status } = useAuth();
  const [acceptInvitation] = useMutation(AcceptInvitationMutation);
  const [state, setState] = useState<State>({ kind: 'pending' });

  // An invitation may be redeemed exactly once; StrictMode's double-invoked
  // effect would otherwise spend the token and then report it invalid.
  const attempted = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setState({ kind: 'needsSignIn' });
      return;
    }

    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        const result = await acceptInvitation({ variables: { token } });
        setState({
          kind: 'accepted',
          organisation: result.data?.acceptInvitation.user.name ?? '',
        });
        onAccepted?.();
      } catch {
        // Expired, revoked, already used, or simply wrong — the recipient can
        // only act on any of them the same way, so they share one outcome.
        setState({ kind: 'invalid' });
      }
    })();
  }, [status, token, acceptInvitation, onAccepted]);

  return (
    <AuthLayout
      title={t('auth.invite.title')}
      subtitle={t('app.tagline')}
    >
      {state.kind === 'pending' ? (
        <div className={styles.notice} role="status">
          <Spinner label={t('auth.invite.accepting')} />
          <p className={styles.noticeBody}>{t('auth.invite.accepting')}</p>
        </div>
      ) : null}

      {state.kind === 'accepted' ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title={t('auth.invite.accepted', { name: state.organisation })}
        />
      ) : null}

      {state.kind === 'needsSignIn' ? (
        <>
          <div className={styles.notice} role="status">
            <p className={styles.noticeBody}>{t('auth.invite.signInFirst')}</p>
          </div>
          <Button fullWidth onClick={onGoToLogin}>
            {t('auth.signIn')}
          </Button>
        </>
      ) : null}

      {state.kind === 'invalid' ? (
        <>
          <EmptyState
            icon={<MailWarning />}
            title={t('auth.invite.invalid')}
            size="sm"
          />
          <Button variant="secondary" fullWidth onClick={onGoToLogin}>
            {t('auth.forgot.backToSignIn')}
          </Button>
        </>
      ) : null}
    </AuthLayout>
  );
}
