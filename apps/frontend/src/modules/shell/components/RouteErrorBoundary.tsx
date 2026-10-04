import { Button } from '@averoui/react';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router';
import { StatusScreen } from '@/modules/shell/components/StatusScreen';
import { ForbiddenPage } from '@/modules/shell/Forbidden.page';
import { NotFoundPage } from '@/modules/shell/NotFound.page';
import { ApiError } from '@/shared/lib/apiError';

type RouteErrorBoundaryProps = {
  /**
   * Set where no layout surrounds the boundary, so the screen still gets a
   * `main` landmark and fills the viewport.
   */
  standalone?: boolean;
};

function UnexpectedError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const description = ApiError.is(error)
    ? t(error.messageKey as never)
    : t('error.unknown');
  const requestId = ApiError.is(error) ? error.requestId : undefined;

  return (
    <StatusScreen
      icon={<TriangleAlert />}
      title={t('status.errorTitle')}
      description={description}
      detail={
        requestId ? (
          <p className="text-text-subtle font-code text-xs">
            {t('error.requestId', { requestId })}
          </p>
        ) : undefined
      }
      action={
        // Navigating to the same place is what clears the router's error
        // state and renders the route again.
        <Button
          onClick={() =>
            void navigate(location, { replace: true, state: location.state })
          }
        >
          {t('common.retry')}
        </Button>
      }
    />
  );
}

/**
 * What a route renders when it throws.
 *
 * "Not allowed" and "does not exist" get their own screens; anything else is
 * an unexpected failure with a retry. Neither a stack trace nor the server's
 * own message is ever shown.
 */
export function RouteErrorBoundary({
  standalone = false,
}: RouteErrorBoundaryProps) {
  const error = useRouteError();

  let screen = <UnexpectedError error={error} />;

  if (ApiError.is(error) && error.kind === 'forbidden') {
    screen = <ForbiddenPage />;
  } else if (
    (ApiError.is(error) && error.kind === 'not_found') ||
    (isRouteErrorResponse(error) && error.status === 404)
  ) {
    screen = <NotFoundPage />;
  }

  if (!standalone) return screen;

  return (
    <main className="grid min-h-dvh place-items-center p-6">{screen}</main>
  );
}
