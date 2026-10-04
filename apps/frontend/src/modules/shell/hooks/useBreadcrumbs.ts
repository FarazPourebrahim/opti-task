import { useTranslation } from 'react-i18next';
import { useMatches } from 'react-router';
import type { BreadcrumbItem } from '@/shared/components';
import { isRouteHandle } from '@/shared/routes/route.types';

/**
 * The breadcrumb trail for the current location, read off the matched routes:
 * every route that declares a `crumb` in its handle contributes one item.
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const { t } = useTranslation();
  const matches = useMatches();

  return matches.flatMap((match) =>
    isRouteHandle(match.handle) && match.handle.crumb
      ? [{ label: t(match.handle.crumb), to: match.pathname }]
      : [],
  );
}
