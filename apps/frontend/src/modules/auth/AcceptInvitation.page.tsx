import { useMutation } from '@apollo/client/react';
import { Alert, Button, EmptyState, Spinner } from '@averoui/react';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AcceptInvitationMutation } from '@/modules/auth/graphql/auth.operations';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { useAuth } from '@/modules/auth/hooks/useAuth';

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
    <AuthLayout title={t('auth.invite.title')} subtitle={t('app.tagline')}>
      {state.kind === 'pending' ? (
        // The text carries the status, so the spinner stays decorative.
        <div
          role="status"
          className="text-text-subtle flex items-center justify-center gap-2 text-sm"
        >
          <Spinner tone="primary" />
          <p>{t('auth.invite.accepting')}</p>
        </div>
      ) : null}

      {state.kind === 'accepted' ? (
        <EmptyState variant="circle" icon={<CheckCircle2 />}>
          {t('auth.invite.accepted', { name: state.organisation })}
        </EmptyState>
      ) : null}

      {state.kind === 'needsSignIn' ? (
        <>
          <Alert tone="neutral" role="status">
            {t('auth.invite.signInFirst')}
          </Alert>
          <Button block onClick={onGoToLogin}>
            {t('auth.signIn')}
          </Button>
        </>
      ) : null}

      {state.kind === 'invalid' ? (
        <>
          <EmptyState variant="circle" icon={<MailWarning />}>
            {t('auth.invite.invalid')}
          </EmptyState>
          <Button variant="outline" block onClick={onGoToLogin}>
            {t('auth.forgot.backToSignIn')}
          </Button>
        </>
      ) : null}
    </AuthLayout>
  );
}
