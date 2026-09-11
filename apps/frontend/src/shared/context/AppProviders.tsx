import { I18nextProvider } from 'react-i18next';
import type { ApolloClient } from '@apollo/client';
import type { ReactNode } from 'react';
import { ApolloRootProvider } from '@/shared/context/apollo.context';
import { TooltipProvider } from '@/shared/components/Popover';
import { ToastProvider } from '@/shared/components/Toast';
import { ThemeProvider } from '@/shared/context/theme.context';
import { i18n } from '@/shared/i18n';

/**
 * Every app-wide provider, in one place.
 *
 * The test harness renders through this same component, so a provider added
 * here reaches the whole suite without touching a single test. Auth joins in
 * Phase 4 and the router in Phase 5.
 */
type AppProvidersProps = {
  children: ReactNode;
  /** Tests pass an isolated client; the app builds its own. */
  apolloClient?: ApolloClient;
};

export function AppProviders({ children, apolloClient }: AppProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ApolloRootProvider {...(apolloClient ? { client: apolloClient } : {})}>
          <ToastProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ToastProvider>
        </ApolloRootProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
