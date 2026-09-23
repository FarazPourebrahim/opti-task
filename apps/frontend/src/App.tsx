import { useTranslation } from 'react-i18next';
import { ComponentsPage } from '@/modules/dev/Components.page';
import { TokensPage } from '@/modules/dev/Tokens.page';
import styles from './App.module.css';

/**
 * Route tree.
 *
 * Phase 5 (F5.1) replaces this with the React Router data router; until then a
 * hash check is the whole routing layer. It stays free of business logic and
 * data fetching either way.
 */
const DEV_ROUTES = {
  tokens: '#/dev/tokens',
  components: '#/dev/components',
} as const;

export function App() {
  const { t } = useTranslation();

  // Development tools, never reachable in a production build: the condition is
  // statically false there, so these pages tree-shake out of the bundle.
  if (import.meta.env.DEV) {
    if (window.location.hash === DEV_ROUTES.tokens) return <TokensPage />;
    if (window.location.hash === DEV_ROUTES.components) return <ComponentsPage />;
  }

  return (
    <main className={styles.home}>
      <div className={styles.homeCard}>
        <h1 className={styles.homeTitle}>{t('app.name')}</h1>
        <p className={styles.homeTagline}>{t('app.tagline')}</p>
        {import.meta.env.DEV ? (
          <nav className={styles.homeDevLinks}>
            <a className={styles.homeDevLink} href={DEV_ROUTES.tokens}>
              {t('dev.tokens.title')}
            </a>
            <a className={styles.homeDevLink} href={DEV_ROUTES.components}>
              {t('dev.components.title')}
            </a>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
