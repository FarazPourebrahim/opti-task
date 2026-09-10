import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { TokensPage } from '@/modules/dev/Tokens.page';
import {
  DURATIONS,
  FONT_SIZES,
  GRAYSCALE,
  RADII,
  SEMANTIC_FAMILIES,
  SHADOWS,
  SPACING,
  SURFACES,
} from '@/modules/dev/tokens.data';
import { THEME_STORAGE_KEY } from '@/shared/lib/theme';
import {
  renderWithProviders,
  screen,
} from '@/shared/tests/renderWithProviders';

beforeEach(() => {
  window.localStorage.clear();
  document.body.className = '';
});

describe('token gallery', () => {
  it('renders a swatch for every token in the inventory', () => {
    // Arrange / Act
    renderWithProviders(<TokensPage />);

    // Assert — every listed token appears by name, so a token added to the
    // system but omitted from the gallery is visible as a gap.
    const tokens = [
      ...GRAYSCALE,
      ...SURFACES,
      ...FONT_SIZES,
      ...SPACING,
      ...RADII,
      ...SHADOWS,
      ...DURATIONS,
    ];

    for (const token of tokens) {
      expect(
        screen.getAllByText(token).length,
        `${token} is missing from the gallery`,
      ).toBeGreaterThan(0);
    }
  });

  it('shows every semantic family with its full ramp', () => {
    renderWithProviders(<TokensPage />);

    for (const family of SEMANTIC_FAMILIES) {
      expect(screen.getByRole('heading', { name: family })).toBeVisible();
    }
    // lighter / base / darker for each family.
    expect(screen.getAllByText('base')).toHaveLength(SEMANTIC_FAMILIES.length);
  });

  it('switches theme and persists the choice', async () => {
    const { user } = renderWithProviders(<TokensPage />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.body.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Light' }));

    expect(document.body.classList.contains('light')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('marks the active theme with aria-pressed, not colour alone', async () => {
    const { user } = renderWithProviders(<TokensPage />);

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it.each(['light', 'dark'])(
    'has no accessibility violations in the %s theme',
    async (theme) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);

      const { container } = renderWithProviders(<TokensPage />);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
