import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './EmptyState.module.css';

type EmptyStateProps = {
  /**
   * An icon or illustration. Required, not optional — the working agreement
   * bans a bare "No data" string, so the type system refuses to build one.
   */
  icon: ReactNode;
  title: string;
  description?: string;
  /** The next action, where one makes sense. */
  action?: { label: string; onClick: () => void };
  /** Compact variant for a board column or a card body. */
  size?: 'sm' | 'md';
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
}: EmptyStateProps) {
  return (
    <div className={styles.emptyState} data-size={size}>
      <span className={styles.emptyStateIcon} aria-hidden>
        {icon}
      </span>
      <p className={styles.emptyStateTitle}>{title}</p>
      {description ? (
        <p className={styles.emptyStateDescription}>{description}</p>
      ) : null}
      {action ? (
        <Button size={size === 'sm' ? 'sm' : 'md'} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

type ErrorStateProps = {
  title: string;
  description?: string;
  /** Quoted by the user in a support request; comes from `ApiError`. */
  requestId?: string;
  onRetry?: () => void;
  size?: 'sm' | 'md';
};

/**
 * The terminal state of a failed load. Visually distinct from `EmptyState`:
 * "nothing here" and "we could not fetch this" must never look alike.
 */
export function ErrorState({
  title,
  description,
  requestId,
  onRetry,
  size = 'md',
}: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.errorState} data-size={size} role="alert">
      <span className={styles.errorStateIcon} aria-hidden>
        <AlertCircle />
      </span>
      <p className={styles.errorStateTitle}>{title}</p>
      {description ? (
        <p className={styles.errorStateDescription}>{description}</p>
      ) : null}
      {requestId ? (
        <p className={styles.errorStateRequestId}>
          {t('error.requestId', { requestId })}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}
