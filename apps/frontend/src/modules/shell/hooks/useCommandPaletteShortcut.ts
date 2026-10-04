import { useEffect } from 'react';

/** Toggles the command palette on ⌘K (macOS) or Ctrl+K (everywhere else). */
export function useCommandPaletteShortcut(onToggle: () => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k') return;
      if (!event.metaKey && !event.ctrlKey) return;

      // Ctrl+K focuses the address bar's search in several browsers.
      event.preventDefault();
      onToggle();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);
}
