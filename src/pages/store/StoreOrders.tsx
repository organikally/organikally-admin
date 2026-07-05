import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { Pill, PaymentStatusPill, StoreOrderStatusPill } from '@/components/ui/StatusPill';
import { dateShort, formatPaise } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { PaymentStatus, StoreOrderAdmin, StoreOrderStatus } from '@/api/types';

const PAGE_SIZE = 20;

const ORDER_STATUSES: StoreOrderStatus[] = [
  'created',
  'pending_payment',
  'paid',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'payment_failed',
  'cancelled',
  'refunded',
];
const PAYMENT_STATUSES: PaymentStatus[] = [
  'created',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
];

export function StoreOrdersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reconOnly, setReconOnly] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'orders', { q: debouncedQ, status, paymentStatus, from, to, reconOnly, page }],
    queryFn: () =>
      storeApi.orders.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as StoreOrderStatus | undefined,
        payment_status: (paymentStatus || undefined) as PaymentStatus | undefined,
        from: from || undefined,
        to: to || undefined,
        needs_reconciliation: reconOnly || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<StoreOrderAdmin>[] = [
    {
      key: 'code',
      header: 'Order',
      render: (o) => (
        <div>
          <div className="flex items-center gap-1.5 font-medium tnum">
            {o.code}
            {o.needs_reconciliation && (
              <span title="Needs reconciliation" className="text-danger">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            )}
          </div>
          <div className="text-xs text-ink-faint">{dateShort(o.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (o) => (
        <div>
          <div>{o.customer_name ?? '—'}</div>
          <div className="text-xs text-ink-faint">{o.customer_email ?? ''}</div>
        </div>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', render: (o) => o.items?.length ?? 0 },
    { key: 'total', header: 'Total', align: 'right', render: (o) => formatPaise(o.total_paise) },
    { key: 'payment', header: 'Payment', render: (o) => <PaymentStatusPill status={o.payment_status} /> },
    { key: 'status', header: 'Status', render: (o) => <StoreOrderStatusPill status={o.status} /> },
    {
      key: 'coupon',
      header: 'Coupon',
      render: (o) => (o.coupon_code ? <Pill tone="neutral">{o.coupon_code}</Pill> : <span className="text-ink-faint">—</span>),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Store Orders"
        description="D2C orders through the payment + fulfillment lifecycle. Razorpay webhooks are the source of truth for paid/refunded."
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search code / customer…" />
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={ORDER_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              placeholder="All statuses"
            />
            <Select
              value={paymentStatus}
              onChange={(v) => { setPaymentStatus(v); setPage(1); }}
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              placeholder="Any payment"
            />
            <div className="flex items-center gap-1 text-xs text-ink-faint">
              <input type="date" className="input w-auto" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
              <span>to</span>
              <input type="date" className="input w-auto" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={reconOnly} onChange={(e) => { setReconOnly(e.target.checked); setPage(1); }} />
              Needs reconciliation
            </label>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(o) => o.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={(o) => navigate(`/store/orders/${o.id}`)}
          emptyTitle="No orders match"
          emptyHint="Adjust the filters above."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
