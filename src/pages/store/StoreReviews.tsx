import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { Pill } from '@/components/ui/StatusPill';
import { dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import type { ReviewStatus, StoreReviewAdmin } from '@/api/types';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<ReviewStatus, 'warning' | 'brand' | 'danger'> = {
  pending: 'warning',
  published: 'brand',
  rejected: 'danger',
};

export function StoreReviewsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'reviews', { q: debouncedQ, status, page }],
    queryFn: () =>
      storeApi.reviews.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as ReviewStatus | undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['store', 'reviews'] });
  }

  const approve = useMutation({
    mutationFn: (r: StoreReviewAdmin) => storeApi.reviews.approve(r.id),
    onSuccess: () => { toast.success('Review published — storefront revalidating'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reject = useMutation({
    mutationFn: ({ review, note }: { review: StoreReviewAdmin; note?: string }) =>
      storeApi.reviews.reject(review.id, note),
    onSuccess: () => { toast.success('Review rejected'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (r: StoreReviewAdmin) => storeApi.reviews.remove(r.id),
    onSuccess: () => { toast.success('Review deleted'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const pending = approve.isPending || reject.isPending || remove.isPending;

  function onReject(review: StoreReviewAdmin) {
    const note = window.prompt('Reason for rejection (optional)');
    if (note === null) return; // cancelled
    reject.mutate({ review, note: note.trim() || undefined });
  }

  function onDelete(review: StoreReviewAdmin) {
    if (!window.confirm(`Delete this review by ${review.customer_name}? This cannot be undone.`)) return;
    remove.mutate(review);
  }

  const columns: Column<StoreReviewAdmin>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <div>
          <div className="font-medium">{r.product_name}</div>
          <div className="text-xs text-ink-faint">/{r.product_slug}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span>{r.customer_name}</span>
          {r.verified_purchase && <Pill tone="brand">verified</Pill>}
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (r) => (
        <span className="text-yellow-deep" aria-label={`${r.rating} out of 5`}>
          {'★'.repeat(r.rating)}
        </span>
      ),
    },
    {
      key: 'review',
      header: 'Review',
      className: 'max-w-md',
      render: (r) => (
        <div>
          {r.title && <div className="font-medium">{r.title}</div>}
          <div className="line-clamp-2 text-xs text-ink-faint">{r.body}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>,
    },
    { key: 'date', header: 'Date', render: (r) => dateShort(r.created_at) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.status !== 'published' && (
            <Button className="h-8 px-2.5" disabled={pending} onClick={() => approve.mutate(r)}>
              Approve
            </Button>
          )}
          {r.status !== 'rejected' && (
            <Button variant="secondary" className="h-8 px-2.5" disabled={pending} onClick={() => onReject(r)}>
              Reject
            </Button>
          )}
          <Button variant="ghost" className="h-8 px-2.5 text-danger" disabled={pending} onClick={() => onDelete(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Moderate customer reviews before they appear on the storefront"
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'published', label: 'Published' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              placeholder="All statuses"
            />
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search review / customer…" />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          emptyTitle="No reviews"
          emptyHint="Reviews appear here as customers submit them on the storefront."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
