import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { AppProviders } from '@/shared/context/AppProviders';

/**
 * The single render entry point for component tests.
 *
 * It wraps in the SAME provider tree the real app uses, so a test can never
 * pass against a provider stack the user never gets.
 */
const AllProviders = AppProviders;

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
