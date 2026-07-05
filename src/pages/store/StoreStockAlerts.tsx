import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, Select } from '@/components/ui/Filters';
import { Pill, StockAlertStatusPill } from '@/components/ui/StatusPill';
import { dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { StockAlertAdmin, StockAlertStatus } from '@/api/types';

const PAGE_SIZE = 25;

export function StoreStockAlertsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['store', 'stock-alerts', { status, page }],
    queryFn: () =>
      storeApi.stockAlerts.list({
        status: (status || undefined) as StockAlertStatus | undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<StockAlertAdmin>[] = [
    { key: 'email', header: 'Subscriber', render: (a) => <span className="font-medium">{a.email}</span> },
    {
      key: 'product',
      header: 'Product',
      render: (a) => (
        <div>
          <div>{a.product_name ?? a.store_product_id}</div>
          <div className="text-xs text-ink-faint tnum">{a.sku_code ?? a.sku_id}</div>
        </div>
      ),
    },
    {
      key: 'open',
      header: 'Open',
      render: (a) => (a.is_open ? <Pill tone="info">awaiting</Pill> : <Pill tone="neutral">closed</Pill>),
    },
    { key: 'status', header: 'Status', render: (a) => <StockAlertStatusPill status={a.status} /> },
    { key: 'created', header: 'Subscribed', render: (a) => dateShort(a.created_at) },
    { key: 'notified', header: 'Notified', render: (a) => (a.notified_at ? dateShort(a.notified_at) : '—') },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Alert Subscribers"
        description="Back-in-stock waitlist. When a product's SKU replenishes, open alerts are emailed and closed automatically."
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'notified', label: 'Notified' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              placeholder="All statuses"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(a) => a.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          emptyTitle="No subscribers"
          emptyHint="No back-in-stock requests match this filter."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
