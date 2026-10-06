import { useCallback, useState } from 'react';

type PageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null | undefined;
};

/**
 * Pages forward through a connection.
 *
 * The cursor is passed back to the API exactly as received: it is opaque, and
 * nothing here reads or builds one.
 */
export function useLoadMore(
  pageInfo: PageInfo | undefined,
  fetchAfter: (cursor: string) => Promise<unknown>,
) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasMore = Boolean(pageInfo?.hasNextPage && pageInfo.endCursor);
  const cursor = pageInfo?.endCursor;

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor) return;

    setIsLoadingMore(true);
    try {
      await fetchAfter(cursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, cursor, fetchAfter]);

  return { hasMore, isLoadingMore, loadMore };
}
