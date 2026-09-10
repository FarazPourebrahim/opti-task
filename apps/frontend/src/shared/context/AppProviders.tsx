import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/shared/components/Popover';
import { ThemeProvider } from '@/shared/context/theme.context';
import { i18n } from '@/shared/i18n';

/**
 * Every app-wide provider, in one place.
 *
 * The test harness renders through this same component, so a provider added
 * here reaches the whole suite without touching a single test. Apollo joins in
 * Phase 3, auth in Phase 4, the router and toasts as their phases land.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
