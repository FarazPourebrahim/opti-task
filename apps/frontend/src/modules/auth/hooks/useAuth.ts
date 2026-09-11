import { useContext } from 'react';
import { AuthContext } from '@/modules/auth/auth.context';
import type { AuthContextValue } from '@/modules/auth/auth.context';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
