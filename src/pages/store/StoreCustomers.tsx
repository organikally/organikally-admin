import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { Pill, CustomerStatusPill } from '@/components/ui/StatusPill';
import { formatPaise, num, dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { CustomerAdmin, CustomerStatus } from '@/api/types';

const PAGE_SIZE = 20;

export function StoreCustomersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'customers', { q: debouncedQ, status, page }],
    queryFn: () =>
      storeApi.customers.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as CustomerStatus | undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<CustomerAdmin>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: (c) => (
        <div>
          <div className="font-medium">{c.name}</div>
          <div className="text-xs text-ink-faint">{c.email}</div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
    {
      key: 'verified',
      header: 'Email',
      render: (c) => (c.email_verified ? <Pill tone="success">verified</Pill> : <Pill tone="warning">unverified</Pill>),
    },
    { key: 'orders', header: 'Orders', align: 'right', render: (c) => num(c.order_summary?.order_count ?? 0) },
    { key: 'ltv', header: 'Lifetime value', align: 'right', render: (c) => formatPaise(c.order_summary?.lifetime_value_paise ?? 0) },
    { key: 'joined', header: 'Joined', render: (c) => dateShort(c.created_at) },
    { key: 'status', header: 'Status', render: (c) => <CustomerStatusPill status={c.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Registered store shoppers with lifetime value and order history. PII handled per DPDP 2023."
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name / email…" />
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'blocked', label: 'Blocked' },
              ]}
              placeholder="Any status"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(c) => c.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={(c) => navigate(`/store/customers/${c.id}`)}
          emptyTitle="No customers"
          emptyHint="No registered shoppers match this filter."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
