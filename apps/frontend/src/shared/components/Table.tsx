import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Table.module.css';

export type SortDirection = 'ASC' | 'DESC';

export type Column<Row> = {
  id: string;
  header: ReactNode;
  /** Renders the cell for a row. */
  cell: (row: Row) => ReactNode;
  /** Marks the column sortable and identifies it to the sort handler. */
  sortable?: boolean;
  align?: 'start' | 'end';
  width?: string;
};

type TableProps<Row> = {
  rows: readonly Row[];
  columns: ReadonlyArray<Column<Row>>;
  rowKey: (row: Row) => string;
  /** Describes the table for assistive technology. */
  caption: string;
  sort?: { columnId: string; direction: SortDirection };
  onSortChange?: (columnId: string) => void;
  /** Rendered in place of the body when there are no rows. */
  emptyState?: ReactNode;
};

/**
 * A data table.
 *
 * Always wrapped in its own horizontal scroll container: a wide table must
 * scroll itself rather than making the page scroll sideways.
 *
 * There is deliberately no `onRowClick`. A click handler on a `<tr>` is
 * reachable by pointer only — it cannot be focused or activated by keyboard,
 * and giving the row a tabindex makes every cell a tab stop. To make a row
 * navigable, render a link or button inside its primary cell instead.
 */
export function Table<Row>({
  rows,
  columns,
  rowKey,
  caption,
  sort,
  onSortChange,
  emptyState,
}: TableProps<Row>) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className={styles.tableCaption}>{caption}</caption>
        <thead className={styles.tableHead}>
          <tr className={styles.tableRow}>
            {columns.map((column) => {
              const isSorted = sort?.columnId === column.id;
              return (
                <th
                  key={column.id}
                  scope="col"
                  className={styles.tableHeaderCell}
                  data-align={column.align ?? 'start'}
                  style={column.width ? { inlineSize: column.width } : undefined}
                  // Conveys the sort state to assistive technology, which the
                  // arrow glyph alone does not.
                  {...(column.sortable
                    ? {
                        'aria-sort': isSorted
                          ? sort.direction === 'ASC'
                            ? ('ascending' as const)
                            : ('descending' as const)
                          : ('none' as const),
                      }
                    : {})}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={styles.tableSortButton}
                      onClick={() => onSortChange(column.id)}
                    >
                      {column.header}
                      <span className={styles.tableSortIcon} aria-hidden>
                        {!isSorted ? (
                          <ChevronsUpDown />
                        ) : sort.direction === 'ASC' ? (
                          <ArrowUp />
                        ) : (
                          <ArrowDown />
                        )}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={styles.tableBody}>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={styles.tableRow}>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={styles.tableCell}
                  data-align={column.align ?? 'start'}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
