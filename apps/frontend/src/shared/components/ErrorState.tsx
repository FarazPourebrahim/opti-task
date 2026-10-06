import { Alert, Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';

type ErrorStateProps = {
  title: string;
  /** Already translated. */
  description?: string | undefined;
  /** Shown so a user can quote it in a support request. */
  requestId?: string | undefined;
  onRetry?: (() => void) | undefined;
};

/**
 * What a failed load resolves into: the cause, a reference the user can quote,
 * and a way to try again. Avero has no equivalent, so this composes its `Alert`.
 */
export function ErrorState({
  title,
  description,
  requestId,
  onRetry,
}: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <Alert
      tone="danger"
      role="alert"
      title={title}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        ) : undefined
      }
    >
      {description ? <p>{description}</p> : null}
      {requestId ? (
        <p className="font-code text-xs">
          {t('error.requestId', { requestId })}
        </p>
      ) : null}
    </Alert>
  );
}
