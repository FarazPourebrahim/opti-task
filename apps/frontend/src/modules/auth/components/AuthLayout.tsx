import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import styles from './AuthLayout.module.css';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * The shared frame for every signed-out screen.
 *
 * A split layout: the brand panel is decorative and collapses away below
 * 900px so a phone gets the form at full width rather than a squeezed column.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main className={styles.authLayout}>
      <section className={styles.brandPanel} aria-hidden>
        <div className={styles.brandContent}>
          <p className={styles.brandName}>{t('app.name')}</p>
          <p className={styles.brandTagline}>{t('app.tagline')}</p>
        </div>
      </section>
      <section className={styles.formPanel}>
        <div className={styles.formCard}>
          <header className={styles.formHeader}>
            <h1 className={styles.formTitle}>{title}</h1>
            <p className={styles.formSubtitle}>{subtitle}</p>
          </header>
          {children}
          {footer ? <footer className={styles.formFooter}>{footer}</footer> : null}
        </div>
      </section>
    </main>
  );
}
