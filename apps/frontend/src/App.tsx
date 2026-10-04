import { useTranslation } from 'react-i18next';

/**
 * Route tree.
 *
 * Phase 5 (F5.1) replaces this with the React Router data router; until then
 * it is a placeholder that stays free of business logic and data fetching.
 */
export function App() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-text-strong text-4xl font-bold tracking-tight">
          {t('app.name')}
        </h1>
        <p className="text-text-subtle text-lg">{t('app.tagline')}</p>
      </div>
    </main>
  );
}
