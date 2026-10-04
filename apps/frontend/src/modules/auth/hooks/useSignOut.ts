import { useCallback, useState } from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

/**
 * Signs the user out, with a pending flag for the control that triggered it.
 *
 * There is no navigation here: ending the session is what makes the route
 * guard send the user to the sign-in screen.
 */
export function useSignOut() {
  const { logout } = useAuth();
  const [isPending, setIsPending] = useState(false);

  const signOut = useCallback(async () => {
    setIsPending(true);
    try {
      await logout();
    } finally {
      setIsPending(false);
    }
  }, [logout]);

  return { signOut, isPending };
}
