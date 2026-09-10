import { useTranslation } from 'react-i18next';
import { TokensPage } from '@/modules/dev/Tokens.page';
import styles from './App.module.css';

/**
 * Route tree.
 *
 * Phase 5 (F5.1) replaces this with the React Router data router; until then a
 * hash check is the whole routing layer. It stays free of business logic and
 * data fetching either way.
 */
const DEV_TOKENS_ROUTE = '#/dev/tokens';

export function App() {
  const { t } = useTranslation();

  // A development tool, never reachable in a production build: the condition is
  // statically false there, so the gallery tree-shakes out of the bundle.
  if (import.meta.env.DEV && window.location.hash === DEV_TOKENS_ROUTE) {
    return <TokensPage />;
  }

  return (
    <main className={styles.home}>
      <div className={styles.homeCard}>
        <h1 className={styles.homeTitle}>{t('app.name')}</h1>
        <p className={styles.homeTagline}>{t('app.tagline')}</p>
        {import.meta.env.DEV ? (
          <a className={styles.homeDevLink} href={DEV_TOKENS_ROUTE}>
            {t('dev.tokens.title')}
          </a>
        ) : null}
      </div>
    </main>
  );
}
