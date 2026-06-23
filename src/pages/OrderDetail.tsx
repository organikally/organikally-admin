import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { orders } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { CreditResultPill, OrderStatusPill, Pill } from '@/components/ui/StatusPill';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { dateTime, money, pct } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import {
  ORDER_FLOW,
  TRANSITION_NOTE,
  isTerminal,
  nextStatuses,
} from '@/lib/orderLifecycle';
import type { OrderLineItem, OrderStatus } from '@/api/types';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const order = useQuery({ queryKey: ['order', id], queryFn: () => orders.get(id) });

  const [transitionTo, setTransitionTo] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideNote, setOverrideNote] = useState('');

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['order', id] });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['inventory'] });
  }

  const transition = useMutation({
    mutationFn: (to: OrderStatus) => orders.transition(id, to, note || undefined),
    onSuccess: () => {
      toast.success('Order updated');
      setTransitionTo(null);
      setNote('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => orders.cancel(id, cancelReason),
    onSuccess: () => {
      toast.success('Order cancelled');
      setCancelOpen(false);
      setCancelReason('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const override = useMutation({
    mutationFn: (approve: boolean) => orders.creditOverride(id, approve, overrideNote || undefined),
    onSuccess: () => {
      toast.success('Credit decision recorded');
      setOverrideOpen(false);
      setOverrideNote('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (order.isLoading) return <LoadingState />;
  if (order.isError || !order.data)
    return <ErrorState message={errorMessage(order.error)} onRetry={() => order.refetch()} />;

  const o = order.data;
  const canDispatch = can('inventory_edit'); // warehouse/admin do order transitions
  const canOverride = can('approve_outlets'); // asm/finance/admin
  const blocked =
    o.credit_check?.result === 'block' || o.credit_check?.result === 'approval_required';

  const lineColumns: Column<OrderLineItem>[] = [
    { key: 'sku', header: 'SKU', render: (l) => <span className="font-medium">{l.sku_name}</span> },
    { key: 'qty', header: 'Qty', align: 'right', render: (l) => l.qty },
    { key: 'price', header: 'Unit price', align: 'right', render: (l) => money(l.unit_price) },
    {
      key: 'disc',
      header: 'Disc.',
      align: 'right',
      render: (l) => (l.discount_pct ? `${pct(l.discount_pct)} (${money(l.discount_amt)})` : '—'),
    },
    { key: 'gst', header: 'GST', align: 'right', render: (l) => `${pct(l.gst_rate)} (${money(l.gst_amt)})` },
    { key: 'total', header: 'Line total', align: 'right', render: (l) => money(l.line_total) },
  ];

  const available = nextStatuses(o.status);

  return (
    <div>
      <PageHeader
        title={`Order ${o.code}`}
        description={`${o.outlet_name ?? ''} · booked ${dateTime(o.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/orders')}>
              All orders
            </Button>
            {!isTerminal(o.status) && (
              <>
                {available
                  .filter((s) => s !== 'cancelled')
                  .map((s) => (
                    <Button
                      key={s}
                      disabled={!canDispatch}
                      title={!canDispatch ? 'Requires warehouse/admin' : ''}
                      onClick={() => { setNote(''); setTransitionTo(s); }}
                    >
                      Move to {s}
                    </Button>
                  ))}
                {available.includes('cancelled') && (
                  <Button variant="danger" onClick={() => setCancelOpen(true)}>
                    Cancel
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Lifecycle stepper */}
      <Card className="mb-4">
        <Stepper current={o.status} />
      </Card>

      {/* Credit block banner */}
      {blocked && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/30 bg-danger/8 px-4 py-3">
          <div className="text-sm text-danger">
            <span className="font-semibold">Credit check: {o.credit_check.result.replace(/_/g, ' ')}.</span>{' '}
            Order value {money(o.credit_check.order_value)} · outstanding {money(o.credit_check.outstanding)} · limit{' '}
            {money(o.credit_check.limit)}.
            {o.credit_check.overridden_by && (
              <span className="ml-2 text-muted">Overridden by {o.credit_check.overridden_by}.</span>
            )}
          </div>
          {canOverride && !o.credit_check.overridden_by && (
            <Button variant="gold" onClick={() => setOverrideOpen(true)}>
              Review credit override
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" pad={false}>
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold">Line items</h3>
          </div>
          <DataTable columns={lineColumns} rows={o.line_items ?? []} rowKey={(l) => l.sku_id} emptyTitle="No line items" />
          <div className="border-t border-line p-4">
            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <Total label="Subtotal" value={o.subtotal} />
              <Total label="Discount" value={-Math.abs(o.discount_total)} />
              <Total label="GST" value={o.gst_total} />
              <div className="flex items-center justify-between border-t border-line pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span className="nums">{money(o.total)}</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={<OrderStatusPill status={o.status} />} />
              <Row label="Credit" value={<CreditResultPill result={o.credit_check?.result ?? 'ok'} />} />
              <Row label="Outlet" value={o.outlet_name ? <Link className="text-brand hover:underline" to={`/outlets/${o.outlet_id}`}>{o.outlet_name}</Link> : o.outlet_id} />
              <Row label="Rep" value={o.rep_name ?? o.rep_id} />
              <Row label="Warehouse" value={o.warehouse_name ?? o.warehouse_id} />
              <Row label="Expected delivery" value={o.expected_delivery_date ? dateTime(o.expected_delivery_date) : '—'} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Status history" />
            <ol className="space-y-3">
              {(o.status_history ?? []).map((h, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    {i < (o.status_history?.length ?? 0) - 1 && <span className="mt-0.5 h-full w-px bg-line" />}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">
                      <OrderStatusPill status={h.status} />
                      <span className="text-xs text-muted">{dateTime(h.at)}</span>
                    </div>
                    <div className="text-xs text-muted">
                      by {h.by}
                      {h.note ? ` — ${h.note}` : ''}
                    </div>
                  </div>
                </li>
              ))}
              {(o.status_history?.length ?? 0) === 0 && (
                <li className="text-sm text-muted">No history yet.</li>
              )}
            </ol>
          </Card>
        </div>
      </div>

      {/* Transition modal */}
      <Modal
        open={!!transitionTo}
        onClose={() => setTransitionTo(null)}
        title={`Move order to ${transitionTo ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransitionTo(null)}>
              Cancel
            </Button>
            <Button disabled={transition.isPending} onClick={() => transitionTo && transition.mutate(transitionTo)}>
              Confirm
            </Button>
          </>
        }
      >
        {transitionTo && TRANSITION_NOTE[transitionTo] && (
          <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-[#7a5e0e]">
            {TRANSITION_NOTE[transitionTo]}
          </div>
        )}
        <Field label="Note (optional)">
          <textarea className="input h-20 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </Modal>

      {/* Cancel modal */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel order"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button variant="danger" disabled={!cancelReason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel order
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-[#7a5e0e]">
          {TRANSITION_NOTE.cancelled}
        </div>
        <Field label="Reason" required>
          <textarea className="input h-20 py-2" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Field>
      </Modal>

      {/* Credit override modal */}
      <Modal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        title="Credit override"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverrideOpen(false)}>
              Close
            </Button>
            <Button variant="danger" disabled={override.isPending} onClick={() => override.mutate(false)}>
              Decline
            </Button>
            <Button variant="gold" disabled={override.isPending} onClick={() => override.mutate(true)}>
              Approve & release
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Approving moves the blocked order forward. This action is audited.
        </p>
        <Field label="Note (optional)">
          <textarea className="input h-20 py-2" value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

function Stepper({ current }: { current: OrderStatus }) {
  if (current === 'cancelled') {
    return (
      <div className="flex items-center gap-2">
        <Pill tone="danger">cancelled</Pill>
        <span className="text-xs text-muted">This order is cancelled (terminal).</span>
      </div>
    );
  }
  const idx = ORDER_FLOW.indexOf(current);
  return (
    <div className="flex items-center overflow-x-auto">
      {ORDER_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1 px-1">
              <span
                className={clsx(
                  'grid h-7 w-7 place-items-center rounded-full text-xs font-semibold',
                  active && 'bg-brand text-cream',
                  done && 'bg-success/20 text-success',
                  !active && !done && 'bg-surface-2 text-muted',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={clsx('text-[11px] capitalize', active ? 'font-semibold text-ink' : 'text-muted')}>
                {s}
              </span>
            </div>
            {i < ORDER_FLOW.length - 1 && (
              <span className={clsx('mx-1 h-px w-8 sm:w-12', i < idx ? 'bg-success' : 'bg-line')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-muted">
      <span>{label}</span>
      <span className="nums">{money(value)}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
