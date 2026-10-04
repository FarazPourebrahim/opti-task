import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import {
  resolveReturnTo,
  toReturnToState,
} from '@/modules/auth/utils/auth.utils';
import { PageLoader } from '@/shared/components';
import { ROUTES } from '@/shared/routes/route.constants';

/**
 * Lets signed-in users through; sends everyone else to sign in, remembering
 * where they were headed.
 *
 * While the session is still being recovered it renders a loader, not a
 * redirect — otherwise a reload would bounce a signed-in user to the login
 * screen before the refresh cookie had been tried.
 */
export function ProtectedRoute() {
  const { status, signedOutByUser } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;

  if (status === 'unauthenticated') {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={signedOutByUser ? null : toReturnToState(location)}
      />
    );
  }

  return <Outlet />;
}

/**
 * The reverse guard, for the signed-out screens: a user who already has a
 * session — or who has just signed in — is moved on to where they were going.
 */
export function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader />;

  if (status === 'authenticated') {
    return <Navigate to={resolveReturnTo(location.state)} replace />;
  }

  return <Outlet />;
}
