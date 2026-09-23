import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/shared/context/theme.context';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  readStoredPreference,
  resolveTheme,
} from '@/shared/lib/theme';
import { act, render, screen } from '@/shared/tests/renderWithProviders';

/** jsdom has no matchMedia; each test declares what the OS reports. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') ? prefersDark : !prefersDark,
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.add(cb),
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        listeners.delete(cb),
      dispatchEvent: () => false,
    })),
  );

  return {
    emit(matches: boolean) {
      for (const cb of listeners) {
        cb({ matches } as MediaQueryListEvent);
      }
    },
  };
}

function ThemeProbe() {
  const { preference, theme, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setPreference('light')}>
        light
      </button>
      <button type="button" onClick={() => setPreference('system')}>
        system
      </button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.body.className = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('theme resolution', () => {
  it('resolves an explicit preference regardless of the system', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('follows the system when the preference is "system"', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
  });

  it('treats an unknown stored value as no choice made', () => {
    expect(isThemePreference('solarized')).toBe(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'solarized');
    expect(readStoredPreference()).toBe('system');
  });

  it('survives storage being unavailable', () => {
    // Arrange — a private window throws on access rather than returning null.
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });

    // Act / Assert
    expect(() => readStoredPreference()).not.toThrow();
    expect(readStoredPreference()).toBe('system');
    getItem.mockRestore();
  });

  it('never leaves both theme classes on the body', () => {
    applyTheme('dark');
    applyTheme('light');

    expect(document.body.classList.contains('light')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(false);
  });
});

describe('ThemeProvider', () => {
  it('honors the system preference when nothing is stored', () => {
    stubMatchMedia(true);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('persists an explicit choice and applies it to the body', async () => {
    stubMatchMedia(true);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'light' }).click();
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.body.classList.contains('light')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('keeps following the system after it changes, not only at boot', async () => {
    const media = stubMatchMedia(false);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');

    await act(async () => {
      media.emit(true);
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('stops following the system once a choice is made', async () => {
    const media = stubMatchMedia(false);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'light' }).click();
    });
    await act(async () => {
      media.emit(true);
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('throws a useful error when used outside the provider', () => {
    // Arrange — React logs the thrown error; silence it for this assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ThemeProbe />)).toThrowError(/ThemeProvider/);

    spy.mockRestore();
  });
});

describe('pre-paint theme script', () => {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

  it('runs inline and before the module bundle, or the flash returns', () => {
    const inlineAt = html.indexOf('optitask-theme');
    const bundleAt = html.indexOf('src="/src/main.tsx"');

    expect(inlineAt).toBeGreaterThan(-1);
    expect(bundleAt).toBeGreaterThan(-1);
    expect(inlineAt).toBeLessThan(bundleAt);
  });

  it('uses the same storage key as the provider', () => {
    expect(html).toContain(THEME_STORAGE_KEY);
  });
});
