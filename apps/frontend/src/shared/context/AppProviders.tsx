import { AveroProvider, ToastProvider } from '@averoui/react';
import { I18nextProvider } from 'react-i18next';
import type { ApolloClient } from '@apollo/client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/modules/auth/auth.context';
import { ApolloRootProvider } from '@/shared/context/apollo.context';
import { i18n } from '@/shared/i18n';

/**
 * Every app-wide provider, in one place.
 *
 * The test harness renders through this same component, so a provider added
 * here reaches the whole suite without touching a single test. The router
 * joins in Phase 5.
 */
type AppProvidersProps = {
  children: ReactNode;
  /** Tests pass an isolated client; the app builds its own. */
  apolloClient?: ApolloClient;
};

/*
 * Avero is Persian-first: with no locale it renders right-to-left with Jalali
 * dates and Persian digits. This app ships `en` only.
 */
const AVERO_LOCALE = 'en-US';

export function AppProviders({ children, apolloClient }: AppProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <AveroProvider locale={AVERO_LOCALE}>
        <ApolloRootProvider {...(apolloClient ? { client: apolloClient } : {})}>
          {/* Inside Apollo: the auth context issues operations through it. */}
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ApolloRootProvider>
      </AveroProvider>
    </I18nextProvider>
  );
}
