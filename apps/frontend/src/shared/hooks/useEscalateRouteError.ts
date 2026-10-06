import type { ApiError } from '@/shared/lib/apiError';

/**
 * Hands a "this whole page is unavailable" failure to the route's error
 * boundary, which renders the Forbidden or Not Found screen in its place.
 *
 * A query hook returns its error rather than throwing it, so without this each
 * page would have to draw those screens itself. Everything else — a network
 * failure, a server error — stays with the page, which shows it inline with a
 * retry.
 */
export function useEscalateRouteError(
  error: ApiError | null | undefined,
): void {
  if (error && (error.kind === 'forbidden' || error.kind === 'not_found')) {
    throw error;
  }
}
