import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { KpiCard } from '@/components/charts/KpiCard';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Pill, CustomerStatusPill, PaymentStatusPill, StoreOrderStatusPill } from '@/components/ui/StatusPill';
import { formatPaise, num, dateShort, dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { Address, StoreOrderAdmin } from '@/api/types';

export function StoreCustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can('store_customers_manage');

  const customer = useQuery({ queryKey: ['store', 'customer', id], queryFn: () => storeApi.customers.get(id) });

  // The orders list accepts an exact customer_id filter (§6.2).
  const orders = useQuery({
    queryKey: ['store', 'customer-orders', id],
    queryFn: () => storeApi.orders.list({ customer_id: id, page_size: 50 }),
  });

  const setStatus = useMutation({
    mutationFn: (next: 'active' | 'blocked') => storeApi.customers.setStatus(id, next),
    onSuccess: (_d, next) => {
      toast.success(next === 'blocked' ? 'Customer blocked' : 'Customer unblocked');
      qc.invalidateQueries({ queryKey: ['store', 'customer', id] });
      qc.invalidateQueries({ queryKey: ['store', 'customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (customer.isLoading) return <LoadingState />;
  if (customer.isError || !customer.data)
    return <ErrorState message={errorMessage(customer.error)} onRetry={() => customer.refetch()} />;

  const c = customer.data;
  const blocked = c.status === 'blocked';

  const orderColumns: Column<StoreOrderAdmin>[] = [
    { key: 'code', header: 'Order', render: (o) => <span className="font-medium tnum">{o.code}</span> },
    { key: 'date', header: 'Placed', render: (o) => dateShort(o.created_at) },
    { key: 'total', header: 'Total', align: 'right', render: (o) => formatPaise(o.total_paise) },
    { key: 'payment', header: 'Payment', render: (o) => <PaymentStatusPill status={o.payment_status} /> },
    { key: 'status', header: 'Status', render: (o) => <StoreOrderStatusPill status={o.status} /> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Customer"
        title={c.name}
        description={c.email}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/store/customers')}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              All customers
            </Button>
            {canManage &&
              (blocked ? (
                <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate('active')}>
                  Unblock
                </Button>
              ) : (
                <Button variant="danger" disabled={setStatus.isPending} onClick={() => { if (confirm(`Block ${c.name}? They cannot check out while blocked.`)) setStatus.mutate('blocked'); }}>
                  Block customer
                </Button>
              ))}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Orders" value={num(c.order_summary?.order_count ?? 0)} sub={c.order_summary?.last_order_at ? `Last ${dateShort(c.order_summary.last_order_at)}` : 'No orders yet'} />
        <KpiCard label="Lifetime value" value={formatPaise(c.order_summary?.lifetime_value_paise ?? 0)} tone="gold" />
        <KpiCard label="Account" value={blocked ? 'Blocked' : 'Active'} sub={c.email_verified ? 'Email verified' : 'Email unverified'} tone={blocked ? 'danger' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <dl className="space-y-2 text-sm">
            <Row label="Status" value={<CustomerStatusPill status={c.status} />} />
            <Row label="Email" value={c.email} />
            <Row label="Email verified" value={c.email_verified ? <Pill tone="success">yes</Pill> : <Pill tone="warning">no</Pill>} />
            <Row label="Phone" value={c.phone ?? '—'} />
            <Row label="Marketing opt-in" value={c.marketing_opt_in ? 'Yes' : 'No'} />
            <Row label="Joined" value={dateShort(c.created_at)} />
            <Row label="Last login" value={c.last_login_at ? dateTime(c.last_login_at) : '—'} />
          </dl>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Addresses" subtitle={`${c.addresses?.length ?? 0} saved`} />
          {(c.addresses?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No saved addresses.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {c.addresses.map((a: Address) => (
                <div key={a.id} className="rounded-chip border border-line p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{a.name}</span>
                    {a.is_default && <Pill tone="brand">default</Pill>}
                    {a.label && <span className="text-xs text-ink-faint">{a.label}</span>}
                  </div>
                  <div className="mt-1 text-ink-muted">
                    <div>{a.phone}</div>
                    <div>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</div>
                    <div>{a.city}, {a.state} {a.pincode}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4" pad={false}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-display text-base leading-tight text-ink">Orders</h3>
          <Link className="text-xs font-semibold text-gold-ink hover:underline" to="/store/orders">
            All orders
          </Link>
        </div>
        <DataTable
          columns={orderColumns}
          rows={orders.data?.items ?? []}
          rowKey={(o) => o.id}
          loading={orders.isLoading}
          onRowClick={(o) => navigate(`/store/orders/${o.id}`)}
          emptyTitle="No orders"
          emptyHint="This customer has not placed any orders yet."
        />
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
