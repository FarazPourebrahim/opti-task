import { Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';

type LoadMoreProps = {
  /** How many items are on screen, and how many exist. */
  shown: number;
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
};

/**
 * The footer of a paginated list: where the user is in it, and a way to get
 * the next page. Loading more appends below the rows already on screen — the
 * spinner lives on this button, never over the list.
 */
export function LoadMore({
  shown,
  total,
  hasMore,
  isLoading,
  onLoadMore,
}: LoadMoreProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-text-subtle text-sm">
        {t('common.showing', { shown, total })}
      </p>
      {hasMore ? (
        <Button
          variant="outline"
          size="sm"
          loading={isLoading}
          onClick={onLoadMore}
        >
          {t('common.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
