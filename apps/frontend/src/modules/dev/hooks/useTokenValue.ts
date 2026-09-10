import { useEffect, useState } from 'react';
import { useTheme } from '@/shared/context/theme.context';

/**
 * Reads a custom property's *resolved* value from the live document.
 *
 * Showing the computed value rather than a hard-coded label means the gallery
 * proves the token actually resolves — a typo'd or deleted token renders blank
 * instead of quietly displaying the string we hoped for.
 */
export function useTokenValue(token: string): string {
  const { theme } = useTheme();
  const [value, setValue] = useState('');

  useEffect(() => {
    const computed = window
      .getComputedStyle(document.body)
      .getPropertyValue(token)
      .trim();

    setValue(computed);
    // Re-read on theme change: surface and shadow tokens resolve differently.
  }, [token, theme]);

  return value;
}
