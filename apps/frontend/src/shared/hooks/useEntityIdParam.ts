import { useParams } from 'react-router';
import { ApiError, messageKeyFor } from '@/shared/lib/apiError';
import { isUuid } from '@/shared/utils/id.utils';

/**
 * Reads an entity id from the route.
 *
 * A parameter that cannot be an id is thrown as "not found", so the route's
 * error boundary shows that screen instead of the page asking the API a
 * question it can only answer with a validation error.
 */
export function useEntityIdParam(name: string): string {
  const value = useParams()[name];

  if (!isUuid(value)) {
    throw new ApiError({
      kind: 'not_found',
      messageKey: messageKeyFor('not_found'),
    });
  }

  return value;
}
