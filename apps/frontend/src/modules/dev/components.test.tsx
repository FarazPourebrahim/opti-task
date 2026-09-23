import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentsPage } from '@/modules/dev/Components.page';
import { auditA11y } from '@/shared/tests/a11y';
import { THEME_STORAGE_KEY } from '@/shared/lib/theme';
import {
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';

beforeEach(() => {
  window.localStorage.clear();
  document.body.className = '';
});

describe('component gallery', () => {
  it('renders a section for every family of primitive', () => {
    renderWithProviders(<ComponentsPage />);

    for (const section of [
      'Buttons',
      'Form controls',
      'Overlays',
      'Navigation',
      'Display',
      'Loading, empty and error states',
    ]) {
      expect(
        screen.getByRole('heading', { name: section }),
        `${section} section is missing`,
      ).toBeVisible();
    }
  });

  it('shows each control in its default, disabled and loading states', () => {
    renderWithProviders(<ComponentsPage />);

    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Loading' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('shows an error field alongside a healthy one', () => {
    renderWithProviders(<ComponentsPage />);

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Task title')).not.toHaveAttribute(
      'aria-invalid',
    );
  });

  it('distinguishes "nothing yet" from "no results" from "failed"', () => {
    renderWithProviders(<ComponentsPage />);

    expect(screen.getByText('No tasks yet')).toBeVisible();
    expect(screen.getByText('No results for this filter')).toBeVisible();

    // Both the invalid field and the failed load announce themselves, so the
    // error state is located by its own copy rather than by role alone.
    const failure = screen.getByText('Could not load tasks');
    expect(failure.closest('[role="alert"]')).not.toBeNull();

    // The two empty states are NOT announced — an empty list is not an error.
    expect(
      screen.getByText('No tasks yet').closest('[role="alert"]'),
    ).toBeNull();
  });

  it('raises a toast from the gallery', async () => {
    const { user } = renderWithProviders(<ComponentsPage />);

    await user.click(screen.getByRole('button', { name: 'Success toast' }));

    expect(await screen.findByText('Task created')).toBeVisible();
  });

  it('opens the confirm dialog with the target named in its description', async () => {
    const { user } = renderWithProviders(<ComponentsPage />);

    await user.click(
      screen.getByRole('button', { name: 'Confirm destructive' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Web Platform');
    expect(dialog).toHaveTextContent('cannot be undone');
  });

  it.each(['light', 'dark'])(
    'has no accessibility violations in the %s theme',
    async (theme) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);

      const { container } = renderWithProviders(<ComponentsPage />);

      expect(await auditA11y(container)).toHaveNoViolations();
    },
  );
});
