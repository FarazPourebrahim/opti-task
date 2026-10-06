import { Skeleton, SkeletonText, Spinner } from '@averoui/react';
import { useTranslation } from 'react-i18next';

/**
 * Full-viewport wait: the session is still being recovered, or the first route
 * chunk is still loading, and there is no frame to put a skeleton in yet.
 */
export function PageLoader() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className="grid min-h-dvh place-items-center"
    >
      <Spinner size="xl" tone="primary" />
    </div>
  );
}

/**
 * The wait inside the app shell, while a route's chunk loads. A skeleton rather
 * than a spinner, so the frame stays still and only the content area changes.
 */
export function PageSkeleton() {
  const { t } = useTranslation();

  return (
    // Skeletons are hidden from assistive technology; the region speaks once.
    <div role="status" aria-busy aria-label={t('common.loading')}>
      <SkeletonText lines={4} />
    </div>
  );
}

/**
 * The wait for a chart, whose library loads apart from the page it sits on.
 * The size of a chart card, so the page does not jump when it arrives.
 */
export function ChartSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-busy aria-label={t('common.loading')}>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
