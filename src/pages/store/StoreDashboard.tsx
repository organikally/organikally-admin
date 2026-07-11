import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/charts/KpiCard';
import { SimpleBar } from '@/components/charts/Charts';
import { Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { StoreOrderStatusPill } from '@/components/ui/StatusPill';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { formatPaise, formatPaiseCompact, num, dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { StoreLowStockItem, StoreRecentOrder } from '@/api/types';

export function StoreDashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useQuery({
    queryKey: ['store', 'analytics', { from, to }],
    queryFn: () => storeApi.analytics.summary({ from: from || undefined, to: to || undefined }),
  });

  // Organikaly Club KPI row (MEMBERSHIP_CONTRACT §8). Rendered only when the
  // analytics endpoint responds; failures stay silent so the dashboard is intact
  // even before the membership backend ships.
  const membership = useQuery({
    queryKey: ['store', 'membership-analytics', { from, to }],
    queryFn: () => storeApi.memberships.analytics({ from: from || undefined, to: to || undefined }),
    retry: false,
  });

  const topProducts = useMemo(
    () =>
      (query.data?.top_products ?? []).slice(0, 8).map((p) => ({
        label: p.name,
        value: p.revenue_paise,
      })),
    [query.data],
  );

  const lowStockColumns: Column<StoreLowStockItem>[] = [
    {
      key: 'sku',
      header: 'Product',
      render: (r) => (
        <Link className="text-gold-ink hover:underline" to={`/store/products/${r.store_product_id}`}>
          {r.sku_code}
        </Link>
      ),
    },
    {
      key: 'qty',
      header: 'Sellable',
      align: 'right',
      render: (r) => <span className="tnum font-medium text-warning">{num(r.sellable_qty)}</span>,
    },
  ];

  const recentColumns: Column<StoreRecentOrder>[] = [
    { key: 'code', header: 'Order', render: (o) => <span className="font-medium tnum">{o.code}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (o) => formatPaise(o.total_paise) },
    { key: 'status', header: 'Status', render: (o) => <StoreOrderStatusPill status={o.status} /> },
    { key: 'at', header: 'Placed', render: (o) => dateShort(o.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Store Dashboard"
        description="D2C store performance: revenue, orders, fulfilment backlog and stock health."
        actions={
          <div className="flex items-center gap-1 text-xs text-ink-faint">
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>to</span>
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Revenue"
              value={formatPaiseCompact(query.data.revenue_paise)}
              sub="Captured net of refunds"
              tone="gold"
            />
            <KpiCard label="Paid orders" value={num(query.data.paid_orders)} sub={`${num(query.data.orders)} total in range`} />
            <KpiCard label="Avg order value" value={formatPaise(query.data.aov_paise)} sub="Revenue / paid orders" />
            <KpiCard
              label="Pending fulfilment"
              value={num(query.data.pending_fulfilment)}
              sub="Paid / confirmed / packed"
              tone={query.data.pending_fulfilment > 0 ? 'danger' : 'default'}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Refunds" value={num(query.data.refunds)} />
            <MiniStat label="Refunded value" value={formatPaiseCompact(query.data.refund_total_paise)} />
            <MiniStat label="Low-stock SKUs" value={num(query.data.low_stock.length)} />
            <MiniStat label="Orders in range" value={num(query.data.orders)} />
          </div>

          {membership.data && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Active members" value={num(membership.data.active_members)} sub="Organikaly Club" />
              <KpiCard
                label="Membership revenue"
                value={formatPaiseCompact(membership.data.membership_revenue_paise)}
                sub="Captured in range"
                tone="gold"
              />
              <KpiCard
                label="Expiring in 30d"
                value={num(membership.data.expiring_30d)}
                sub="Renewal outreach"
                tone={membership.data.expiring_30d > 0 ? 'danger' : 'default'}
              />
              <KpiCard label="Coins outstanding" value={num(membership.data.coins_outstanding)} sub="Wallet liability" />
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Top products" subtitle="Revenue by product in the selected range" />
              {topProducts.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-faint">No sales in range.</p>
              ) : (
                <SimpleBar data={topProducts} valueFormatter={(v) => formatPaiseCompact(v)} />
              )}
            </Card>

            <Card pad={false}>
              <div className="border-b border-line px-4 py-3">
                <h3 className="font-display text-base leading-tight text-ink">Low stock</h3>
                <p className="mt-0.5 text-xs text-ink-faint">Published products at or below threshold</p>
              </div>
              <DataTable
                columns={lowStockColumns}
                rows={query.data.low_stock}
                rowKey={(r) => r.store_product_id}
                emptyTitle="All stocked"
                emptyHint="No published product is low on stock."
              />
            </Card>
          </div>

          <Card className="mt-4" pad={false}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-display text-base leading-tight text-ink">Recent orders</h3>
              <Link className="text-xs font-semibold text-gold-ink hover:underline" to="/store/orders">
                All orders
              </Link>
            </div>
            <DataTable
              columns={recentColumns}
              rows={query.data.recent_orders}
              rowKey={(o) => o.code}
              emptyTitle="No recent orders"
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="tnum mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
