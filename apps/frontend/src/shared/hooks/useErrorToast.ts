import { useToast } from '@averoui/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/shared/lib/apiError';

/**
 * Reports a failed action in a toast.
 *
 * This is where a `FORBIDDEN` on an action the UI offered ends up: capability
 * hints only hide controls, so every mutation's failure path still has to
 * explain a refusal rather than fail silently.
 */
export function useErrorToast() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useCallback(
    (error: unknown) => {
      // The app's own doing (unmount, superseded request) — never shown.
      if (ApiError.is(error) && error.kind === 'aborted') return;

      toast({
        tone: 'danger',
        title: ApiError.is(error)
          ? t(error.messageKey as never)
          : t('error.unknown'),
        ...(ApiError.is(error) && error.requestId
          ? {
              description: t('error.requestId', {
                requestId: error.requestId,
              }),
            }
          : {}),
      });
    },
    [t, toast],
  );
}
