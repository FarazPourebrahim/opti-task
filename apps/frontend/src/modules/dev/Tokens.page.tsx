import { useTranslation } from 'react-i18next';
import { TokenSwatch } from '@/modules/dev/components/TokenSwatch';
import {
  DURATIONS,
  FONT_SIZES,
  GRAYSCALE,
  RADII,
  SEMANTIC_FAMILIES,
  SEMANTIC_VARIANTS,
  SHADOWS,
  SPACING,
  SURFACES,
} from '@/modules/dev/tokens.data';
import { useTheme } from '@/shared/context/theme.context';
import { THEME_PREFERENCES } from '@/shared/lib/theme';
import styles from './Tokens.page.module.css';

/**
 * Dev-only gallery of every design token, in the active theme.
 *
 * Its job is to make a broken token visible: values are read from the live
 * document, so a deleted or misspelled token renders blank rather than
 * silently falling back.
 */
export function TokensPage() {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <main className={styles.tokensPage}>
      <header className={styles.pageHeader}>
        <div className={styles.headerText}>
          <h1 className={styles.pageTitle}>{t('dev.tokens.title')}</h1>
          <p className={styles.pageSubtitle}>{t('dev.tokens.subtitle')}</p>
        </div>
        <div className={styles.themeSwitch} role="group" aria-label={t('theme.label')}>
          {THEME_PREFERENCES.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.themeOption}
              aria-pressed={preference === option}
              onClick={() => setPreference(option)}
            >
              {t(`theme.${option}`)}
            </button>
          ))}
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.grayscale')}</h2>
        <div className={styles.swatchGrid}>
          {GRAYSCALE.map((token) => (
            <TokenSwatch key={token} token={token} preview="color" />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.semantic')}</h2>
        <div className={styles.familyList}>
          {SEMANTIC_FAMILIES.map((family) => (
            <div key={family} className={styles.family}>
              <h3 className={styles.familyName}>{family}</h3>
              <div className={styles.familyRamp}>
                {SEMANTIC_VARIANTS.map((variant) => {
                  const token = variant
                    ? `--color-${family}-${variant}`
                    : `--color-${family}`;
                  return (
                    <TokenSwatch
                      key={token}
                      token={token}
                      preview="color"
                      label={variant || 'base'}
                    />
                  );
                })}
              </div>
              <p
                className={styles.familyOpposite}
                style={{
                  backgroundColor: `var(--color-${family})`,
                  color: `var(--color-${family}-opposite)`,
                }}
              >
                {t('dev.tokens.opposite')}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.surfaces')}</h2>
        <div className={styles.swatchGrid}>
          {SURFACES.map((token) => (
            <TokenSwatch key={token} token={token} preview="color" />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.typography')}</h2>
        <ul className={styles.typeList}>
          {FONT_SIZES.map((token) => (
            <li key={token} className={styles.typeRow}>
              <span className={styles.typeLabel}>{token}</span>
              <span
                className={styles.typeSample}
                style={{ fontSize: `var(${token})` }}
              >
                {t('dev.tokens.sample')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.spacing')}</h2>
        <div className={styles.swatchGrid}>
          {SPACING.map((token) => (
            <TokenSwatch key={token} token={token} preview="size" />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.radius')}</h2>
        <div className={styles.swatchGrid}>
          {RADII.map((token) => (
            <TokenSwatch key={token} token={token} preview="radius" />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.shadows')}</h2>
        <div className={styles.swatchGrid}>
          {SHADOWS.map((token) => (
            <TokenSwatch key={token} token={token} preview="shadow" />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('dev.tokens.motion')}</h2>
        <div className={styles.swatchGrid}>
          {DURATIONS.map((token) => (
            <TokenSwatch key={token} token={token} preview="size" />
          ))}
        </div>
      </section>
    </main>
  );
}
