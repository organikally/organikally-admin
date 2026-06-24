import type { ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorState } from './primitives';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  error,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyHint,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  if (loading) return <TableSkeleton cols={columns.length} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} hint={emptyHint} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-line bg-surface/95 backdrop-blur">
            {columns.map((c) => (
              <th
                key={c.key}
                className={clsx(
                  'th',
                  c.align === 'right' && 'text-right',
                  c.align === 'center' && 'text-center',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={clsx('row-hover', onRowClick && 'cursor-pointer')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={clsx(
                    'td',
                    c.align === 'right' && 'text-right tnum',
                    c.align === 'center' && 'text-center',
                    c.className,
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-xs text-ink-faint">
      <span className="tnum">
        {from} to {to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="btn-secondary h-8 min-h-8 px-2.5 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          Prev
        </button>
        <span className="tnum px-1">
          {page} / {totalPages}
        </span>
        <button
          className="btn-secondary h-8 min-h-8 px-2.5 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
