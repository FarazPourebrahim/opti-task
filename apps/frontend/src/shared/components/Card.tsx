import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = {
  children: ReactNode;
  /** Adds hover elevation; use when the whole card is a link or button. */
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg';
};

export function Card({
  children,
  interactive = false,
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={styles.card}
      data-interactive={interactive || undefined}
      data-padding={padding}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.cardHeader}>
      <div className={styles.cardHeaderText}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {description ? (
          <p className={styles.cardDescription}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className={styles.cardActions}>{actions}</div> : null}
    </div>
  );
}

export type BreadcrumbItem = {
  label: string;
  /** Omit on the final crumb — the current page is not a link. */
  href?: string;
};

export function Breadcrumbs({
  items,
  label,
}: {
  items: readonly BreadcrumbItem[];
  label: string;
}) {
  return (
    <nav className={styles.breadcrumbs} aria-label={label}>
      <ol className={styles.breadcrumbsList}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={styles.breadcrumbsItem}>
              {item.href && !isLast ? (
                <a className={styles.breadcrumbsLink} href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span
                  className={styles.breadcrumbsCurrent}
                  {...(isLast ? { 'aria-current': 'page' } : {})}
                >
                  {item.label}
                </span>
              )}
              {isLast ? null : (
                <ChevronRight className={styles.breadcrumbsSeparator} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
