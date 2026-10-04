import { useTranslation } from 'react-i18next';
import { useMatches } from 'react-router';
import type { BreadcrumbItem } from '@/shared/components';
import { useBreadcrumbLabels } from '@/shared/context/breadcrumb.context';
import { isRouteHandle } from '@/shared/routes/route.types';

/**
 * The breadcrumb trail for the current location, read off the matched routes:
 * every route that declares a `crumb` in its handle contributes one item, named
 * by the page's data where the route asks for that.
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const { t } = useTranslation();
  const matches = useMatches();
  const labels = useBreadcrumbLabels();

  return matches.flatMap((match) => {
    if (!isRouteHandle(match.handle) || !match.handle.crumb) return [];

    const { crumb, crumbId } = match.handle;
    const named = crumbId ? labels[crumbId] : undefined;

    return [{ label: named ?? t(crumb), to: match.pathname }];
  });
}
