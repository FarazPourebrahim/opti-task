/**
 * Theme resolution and persistence, kept free of React so it can be unit
 * tested and reused by the pre-paint script in index.html.
 */

export const THEME_STORAGE_KEY = 'optitask-theme';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** What actually gets painted — `system` always resolves to one of these. */
export type ResolvedTheme = 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/**
 * Storage can throw outright in a private window or with site data blocked, so
 * every access is guarded. A missing or corrupt value is not an error — it
 * means "no choice made yet".
 */
export function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredPreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A viewer who blocks storage still gets a working theme for this session.
  }
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

/**
 * The themes are `body.light` / `body.dark` classes, so applying one must also
 * remove the other — leaving both attached makes the later rule silently win.
 */
export function applyTheme(theme: ResolvedTheme): void {
  const { classList } = document.body;
  classList.remove('light', 'dark');
  classList.add(theme);
}
