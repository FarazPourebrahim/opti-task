import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';

/**
 * The single render entry point for component tests.
 *
 * Every test renders through here so a newly added provider reaches the whole
 * suite in one edit. Providers land as their phases do: theme + i18n (Phase 1),
 * Apollo (Phase 3), auth (Phase 4), router (Phase 5), toasts (Phase 2).
 */
function AllProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
};

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderWithProvidersResult {
  const user = userEvent.setup();
  const result = render(ui, { wrapper: AllProviders, ...options });

  return { ...result, user };
}

export * from '@testing-library/react';
