import { useMutation } from '@apollo/client/react';
import { Alert, Button, EmptyState, Spinner } from '@averoui/react';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import { AcceptInvitationMutation } from '@/modules/auth/graphql/auth.operations';
import { AuthLayout } from '@/modules/auth/components/AuthLayout';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { toReturnToState } from '@/modules/auth/utils/auth.utils';
import { ROUTE_PARAMS, ROUTES } from '@/shared/routes/route.constants';

type State = 'pending' | 'accepted' | 'needsSignIn' | 'invalid';

/**
 * Redeems an organisation invitation link.
 *
 * Accepting requires a signed-in account — the invitation binds an existing
 * user to an organisation — so an anonymous visitor is asked to sign in first
 * rather than being shown a failure they cannot act on. Signing in returns
 * them to this link.
 */
export function AcceptInvitationPage() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const location = useLocation();
  const token = useParams()[ROUTE_PARAMS.invitationToken];
  const [acceptInvitation] = useMutation(AcceptInvitationMutation);
  const [state, setState] = useState<State>('pending');

  // An invitation may be redeemed exactly once; StrictMode's double-invoked
  // effect would otherwise spend the token and then report it invalid.
  const attempted = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setState('needsSignIn');
      return;
    }

    if (!token) {
      setState('invalid');
      return;
    }

    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        await acceptInvitation({ variables: { token } });
        setState('accepted');
      } catch {
        // Expired, revoked, already used, or simply wrong — the recipient can
        // only act on any of them the same way, so they share one outcome.
        setState('invalid');
      }
    })();
  }, [status, token, acceptInvitation]);

  return (
    <AuthLayout title={t('auth.invite.title')} subtitle={t('app.tagline')}>
      {state === 'pending' ? (
        // The text carries the status, so the spinner stays decorative.
        <div
          role="status"
          className="text-text-subtle flex items-center justify-center gap-2 text-sm"
        >
          <Spinner tone="primary" />
          <p>{t('auth.invite.accepting')}</p>
        </div>
      ) : null}

      {state === 'accepted' ? (
        <>
          <EmptyState variant="circle" icon={<CheckCircle2 />}>
            {t('auth.invite.accepted')}
          </EmptyState>
          <Button asChild block>
            <RouterLink to={ROUTES.home}>
              {t('auth.invite.continue')}
            </RouterLink>
          </Button>
        </>
      ) : null}

      {state === 'needsSignIn' ? (
        <>
          <Alert tone="neutral" role="status">
            {t('auth.invite.signInFirst')}
          </Alert>
          <Button asChild block>
            <RouterLink to={ROUTES.login} state={toReturnToState(location)}>
              {t('auth.signIn')}
            </RouterLink>
          </Button>
        </>
      ) : null}

      {state === 'invalid' ? (
        <>
          <EmptyState variant="circle" icon={<MailWarning />}>
            {t('auth.invite.invalid')}
          </EmptyState>
          <Button asChild variant="outline" block>
            <RouterLink to={ROUTES.home}>{t('nav.backHome')}</RouterLink>
          </Button>
        </>
      ) : null}
    </AuthLayout>
  );
}
