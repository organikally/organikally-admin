import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { orders } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { CreditResultPill, OrderStatusPill } from '@/components/ui/StatusPill';
import { dateShort, money } from '@/lib/format';
import { useDebounced } from '@/lib/useDebounced';
import { ORDER_FLOW } from '@/lib/orderLifecycle';
import type { Order, OrderStatus } from '@/api/types';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [...ORDER_FLOW, 'cancelled'].map((s) => ({
  value: s,
  label: s,
}));

export function OrdersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['orders', { q: debouncedQ, status, from, to, page }],
    queryFn: () =>
      orders.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as OrderStatus | undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<Order>[] = [
    {
      key: 'code',
      header: 'Order',
      render: (o) => (
        <div>
          <div className="font-medium nums">{o.code}</div>
          <div className="text-xs text-muted">{dateShort(o.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'outlet',
      header: 'Outlet',
      render: (o) => o.outlet_name ?? o.outlet_id,
    },
    { key: 'rep', header: 'Rep', render: (o) => o.rep_name ?? o.rep_id },
    { key: 'lines', header: 'Lines', align: 'right', render: (o) => o.line_items?.length ?? 0 },
    { key: 'total', header: 'Total', align: 'right', render: (o) => money(o.total) },
    {
      key: 'credit',
      header: 'Credit',
      render: (o) => <CreditResultPill result={o.credit_check?.result ?? 'ok'} />,
    },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusPill status={o.status} /> },
    {
      key: 'eta',
      header: 'Expected delivery',
      render: (o) => dateShort(o.expected_delivery_date),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Booked orders moving through the pre-sales lifecycle — book → submit → approve → allocate → dispatch → deliver → invoice."
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search order / outlet…" />
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
            <div className="flex items-center gap-1 text-xs text-muted">
              <input type="date" className="input w-auto" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
              <span>to</span>
              <input type="date" className="input w-auto" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(o) => o.id}
          loading={query.isLoading}
          onRowClick={(o) => navigate(`/orders/${o.id}`)}
          emptyTitle="No orders match"
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
