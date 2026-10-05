import { Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { CommandPalette } from '@/modules/shell/components/CommandPalette';
import { Navigation } from '@/modules/shell/components/Navigation';
import { Topbar } from '@/modules/shell/components/Topbar';
import { MAIN_CONTENT_ID } from '@/modules/shell/constants/shell.constants';
import { useCommandPaletteShortcut } from '@/modules/shell/hooks/useCommandPaletteShortcut';
import { PageSkeleton } from '@/shared/components';
import { BreadcrumbProvider } from '@/shared/context/breadcrumb.context';
import { useRealtimeCatchUp } from '@/shared/hooks/useRealtime';

/**
 * The frame every signed-in screen renders inside: sidebar, top bar and the
 * `main` region the current route fills.
 *
 * Below `lg` the sidebar is not rendered here at all — its contents move into
 * the drawer the top bar opens.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const togglePalette = useCallback(
    () => setIsPaletteOpen((isOpen) => !isOpen),
    [],
  );
  useCommandPaletteShortcut(togglePalette);
  // After the live connection has been down, what is on screen is re-read.
  useRealtimeCatchUp();

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-dvh">
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="bg-surface text-text-strong sr-only z-(--z-popover) rounded-lg px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {t('nav.skipToContent')}
        </a>

        <aside className="border-border-subtle bg-surface sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-e p-4 lg:flex">
          <p className="text-text-strong px-3 text-lg font-extrabold tracking-tight">
            {t('app.name')}
          </p>
          <Navigation />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onOpenCommandPalette={() => setIsPaletteOpen(true)} />

          {/* Focusable so the skip link has somewhere to land. */}
          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 p-4 outline-none lg:p-8"
          >
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <CommandPalette open={isPaletteOpen} onOpenChange={setIsPaletteOpen} />
      </div>
    </BreadcrumbProvider>
  );
}
