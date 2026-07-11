import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { KpiCard } from '@/components/charts/KpiCard';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import {
  Pill,
  MembershipStatusPill,
  PaymentStatusPill,
  StoreOrderStatusPill,
} from '@/components/ui/StatusPill';
import { formatPaise, num, dateShort, dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { CoinLedgerEntry, StoreOrderAdmin } from '@/api/types';

export function StoreMemberDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can('store_customers_manage');

  const membership = useQuery({
    queryKey: ['store', 'membership', id],
    queryFn: () => storeApi.memberships.get(id),
  });

  const customerId = membership.data?.customer_id ?? membership.data?.customer?.id ?? '';

  const wallet = useQuery({
    queryKey: ['store', 'wallet', customerId],
    queryFn: () => storeApi.wallets.get(customerId),
    enabled: !!customerId,
  });

  const orders = useQuery({
    queryKey: ['store', 'member-orders', customerId],
    queryFn: () => storeApi.orders.list({ customer_id: customerId, page_size: 50 }),
    enabled: !!customerId,
  });

  const [extendOpen, setExtendOpen] = useState(false);
  const [days, setDays] = useState('365');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['store', 'membership', id] });
    qc.invalidateQueries({ queryKey: ['store', 'memberships'] });
    qc.invalidateQueries({ queryKey: ['store', 'wallet', customerId] });
  }

  const grant = useMutation({
    mutationFn: () => storeApi.memberships.grant({ customer_id: customerId }),
    onSuccess: () => {
      toast.success('Membership granted');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: () => storeApi.memberships.revoke(id),
    onSuccess: () => {
      toast.success('Membership revoked');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const extend = useMutation({
    mutationFn: (d: number) => storeApi.memberships.extend(id, d),
    onSuccess: () => {
      toast.success('Membership extended');
      setExtendOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const adjust = useMutation({
    mutationFn: (body: { delta_coins: number; note: string }) =>
      storeApi.wallets.adjust(customerId, body),
    onSuccess: () => {
      toast.success('Coin balance adjusted');
      setAdjustOpen(false);
      setDelta('');
      setNote('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const orderStats = useMemo(() => {
    const items = orders.data?.items ?? [];
    const paid = items.filter((o) => o.paid_at || o.payment_status === 'captured');
    const ltv = paid.reduce((sum, o) => sum + (o.total_paise ?? 0), 0);
    const lastAt = items.reduce<string | null>((acc, o) => {
      if (!acc) return o.created_at;
      return new Date(o.created_at) > new Date(acc) ? o.created_at : acc;
    }, null);
    return { count: orders.data?.total ?? items.length, ltv, lastAt };
  }, [orders.data]);

  if (membership.isLoading) return <LoadingState />;
  if (membership.isError || !membership.data)
    return <ErrorState message={errorMessage(membership.error)} onRetry={() => membership.refetch()} />;

  const m = membership.data;
  const isLive = m.status === 'active' || m.status === 'pending';
  const walletBalance = wallet.data?.balance_coins ?? m.wallet_balance_coins ?? 0;
  const ledger = wallet.data?.ledger ?? [];

  const ledgerColumns: Column<CoinLedgerEntry>[] = [
    { key: 'at', header: 'When', render: (l) => dateTime(l.at ?? l.created_at) },
    {
      key: 'reason',
      header: 'Reason',
      render: (l) => <Pill tone="neutral">{l.reason.replace(/_/g, ' ')}</Pill>,
    },
    {
      key: 'delta',
      header: 'Change',
      align: 'right',
      render: (l) => (
        <span className={`tnum font-medium ${l.delta_coins >= 0 ? 'text-success' : 'text-danger'}`}>
          {l.delta_coins >= 0 ? '+' : ''}
          {num(l.delta_coins)}
        </span>
      ),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (l) => <span className="tnum">{num(l.balance_after)}</span> },
    { key: 'note', header: 'Note', render: (l) => l.note ?? '—' },
  ];

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
        eyebrow="Organikaly Club member"
        title={m.customer?.name ?? 'Member'}
        description={m.customer?.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/store/members')}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              All members
            </Button>
            {canManage && (
              <>
                {isLive ? (
                  <>
                    <Button variant="secondary" disabled={extend.isPending} onClick={() => setExtendOpen(true)}>
                      Extend
                    </Button>
                    <Button
                      variant="danger"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (confirm('Revoke this membership? It moves to cancelled.')) revoke.mutate();
                      }}
                    >
                      Revoke
                    </Button>
                  </>
                ) : (
                  <Button disabled={grant.isPending || !customerId} onClick={() => grant.mutate()}>
                    Grant membership
                  </Button>
                )}
                <Button variant="secondary" disabled={!customerId} onClick={() => setAdjustOpen(true)}>
                  Adjust coins
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Membership"
          value={m.status[0].toUpperCase() + m.status.slice(1)}
          sub={m.plan_name}
          tone={m.status === 'active' ? 'default' : m.status === 'cancelled' ? 'danger' : 'default'}
        />
        <KpiCard
          label="Days remaining"
          value={typeof m.days_remaining === 'number' ? num(Math.max(0, m.days_remaining)) : '—'}
          sub={m.expires_at ? `Expires ${dateShort(m.expires_at)}` : 'No expiry set'}
        />
        <KpiCard label="Wallet" value={`${num(walletBalance)} coins`} tone="gold" sub="Organikaly Coins" />
        <KpiCard
          label="Orders"
          value={num(orderStats.count)}
          sub={orderStats.lastAt ? `Last ${dateShort(orderStats.lastAt)}` : 'No orders yet'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Membership" />
          <dl className="space-y-2 text-sm">
            <Row label="Status" value={<MembershipStatusPill status={m.status} />} />
            <Row label="Plan" value={m.plan_name} />
            <Row label="Price" value={formatPaise(m.price_paise)} />
            <Row label="Started" value={m.started_at ? dateShort(m.started_at) : '—'} />
            <Row label="Expires" value={m.expires_at ? dateShort(m.expires_at) : '—'} />
            <Row label="Auto-renew" value={m.auto_renew ? 'Yes' : 'No'} />
            <Row label="Renewal" value={m.is_renewal ? <Pill tone="info">renewal</Pill> : '—'} />
            <Row label="Payment" value={m.payment_status ? <PaymentStatusPill status={m.payment_status} /> : '—'} />
            <Row label="Razorpay order" value={m.razorpay_order_id ? <span className="tnum text-xs">{m.razorpay_order_id}</span> : '—'} />
            <Row label="Joined" value={dateShort(m.created_at)} />
          </dl>
        </Card>

        <Card className="xl:col-span-2" pad={false}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h3 className="font-display text-base leading-tight text-ink">Coin wallet</h3>
              <p className="mt-0.5 text-xs text-ink-faint">
                Balance <span className="tnum font-medium text-ink">{num(walletBalance)}</span> coins · append-only ledger
              </p>
            </div>
          </div>
          <DataTable
            columns={ledgerColumns}
            rows={ledger}
            rowKey={(l) => `${l.at ?? l.created_at ?? ''}-${l.delta_coins}-${l.balance_after}`}
            loading={wallet.isLoading}
            error={wallet.isError ? errorMessage(wallet.error) : null}
            onRetry={() => wallet.refetch()}
            emptyTitle="No coin activity"
            emptyHint="Coin earn / redeem / adjustment rows appear here."
          />
        </Card>
      </div>

      <Card className="mt-4" pad={false}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="font-display text-base leading-tight text-ink">Orders</h3>
          <span className="text-xs text-ink-faint">
            Lifetime value <span className="tnum font-medium text-ink">{formatPaise(orderStats.ltv)}</span>
          </span>
        </div>
        <DataTable
          columns={orderColumns}
          rows={orders.data?.items ?? []}
          rowKey={(o) => o.id}
          loading={orders.isLoading}
          onRowClick={(o) => navigate(`/store/orders/${o.id}`)}
          emptyTitle="No orders"
          emptyHint="This member has not placed any orders yet."
        />
      </Card>

      <Modal
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        title="Extend membership"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExtendOpen(false)}>
              Cancel
            </Button>
            <Button disabled={extend.isPending || !days || Number(days) <= 0} onClick={() => extend.mutate(Number(days))}>
              Extend
            </Button>
          </>
        }
      >
        <Field label="Extend by (days)" hint="Adds to the current expiry (or from today if lapsed).">
          <input
            className="input tnum"
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </Field>
      </Modal>

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust coin balance"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={adjust.isPending || !delta || Number(delta) === 0 || !note.trim()}
              onClick={() => adjust.mutate({ delta_coins: Number(delta), note: note.trim() })}
            >
              Apply adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Delta coins" hint="Positive credits, negative debits. Balance never goes below zero." required>
            <input
              className="input tnum"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 100 or -50"
            />
          </Field>
          <Field label="Note" hint="Recorded on the ledger row and the audit log." required>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment" />
          </Field>
        </div>
      </Modal>
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
