import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Spinner } from './Spinner';
import styles from './Skeleton.module.css';

type SkeletonProps = {
  /** Any CSS length; defaults to filling the container. */
  width?: string;
  height?: string;
  shape?: 'line' | 'block' | 'circle';
};

/**
 * A single shimmering placeholder.
 *
 * Marked `aria-hidden`: a skeleton is a visual placeholder, and announcing a
 * dozen of them is noise. The container that holds them owns the `aria-busy`
 * or status message instead — see `SkeletonList`.
 */
export function Skeleton({ width, height, shape = 'line' }: SkeletonProps) {
  return (
    <span
      className={styles.skeleton}
      data-shape={shape}
      aria-hidden
      style={{
        ...(width ? { inlineSize: width } : {}),
        ...(height ? { blockSize: height } : {}),
      }}
    />
  );
}

type SkeletonListProps = {
  count?: number;
  /** Announced while the placeholder is showing. */
  label: string;
};

export function SkeletonList({ count = 4, label }: SkeletonListProps) {
  return (
    <div className={styles.skeletonList} role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton shape="circle" width="2rem" height="2rem" />
          <div className={styles.skeletonRowText}>
            <Skeleton width="40%" />
            <Skeleton width="70%" />
          </div>
        </div>
      ))}
    </div>
  );
}

type LoadMoreProps = {
  onLoadMore: () => void;
  isLoading: boolean;
  /** False when the cursor is exhausted; the control then renders nothing. */
  hasMore: boolean;
  label: string;
};

/**
 * Appends to a paginated list.
 *
 * Loading more must never replace what is already on screen, so the pending
 * indicator lives here, below the list, rather than swapping it for a skeleton.
 */
export function LoadMore({
  onLoadMore,
  isLoading,
  hasMore,
  label,
}: LoadMoreProps) {
  const { t } = useTranslation();

  if (!hasMore) return null;

  return (
    <div className={styles.loadMore}>
      {isLoading ? (
        <span className={styles.loadMoreSpinner}>
          <Spinner size="sm" label={t('common.loading')} />
        </span>
      ) : (
        <Button variant="secondary" size="sm" onClick={onLoadMore}>
          {label}
        </Button>
      )}
    </div>
  );
}
