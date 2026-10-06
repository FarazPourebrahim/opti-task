import { Suspense } from 'react';
import { Outlet } from 'react-router';
import { PageLoader } from '@/shared/components';

/**
 * The outermost route element. It exists to hold the suspense boundary for
 * route chunks that load before any layout is on screen.
 */
export function RootLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}
