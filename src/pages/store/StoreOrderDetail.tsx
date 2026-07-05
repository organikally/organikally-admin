import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Check, AlertTriangle, Package, Truck, PackageCheck, Ban, IndianRupee } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import {
  Pill,
  PaymentStatusPill,
  ShipmentStatusPill,
  StoreOrderStatusPill,
} from '@/components/ui/StatusPill';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { dateTime, formatPaise, inrToPaise } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import {
  STORE_ORDER_FLOW,
  availableStoreActions,
  isStoreTerminal,
  STORE_ACTION_NOTE,
} from '@/lib/storeOrderLifecycle';
import type { StoreLineItem, StoreOrderStatus } from '@/api/types';

export function StoreOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const order = useQuery({ queryKey: ['store', 'order', id], queryFn: () => storeApi.orders.get(id) });

  const [shipOpen, setShipOpen] = useState(false);
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [restock, setRestock] = useState(true);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['store', 'order', id] });
    qc.invalidateQueries({ queryKey: ['store', 'orders'] });
  }

  const pack = useMutation({
    mutationFn: () => storeApi.orders.pack(id),
    onSuccess: () => { toast.success('Marked packed'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ship = useMutation({
    mutationFn: () => storeApi.orders.ship(id, { courier, awb, tracking_url: trackingUrl || undefined }),
    onSuccess: () => { toast.success('Shipped — email sent'); setShipOpen(false); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const deliver = useMutation({
    mutationFn: () => storeApi.orders.deliver(id),
    onSuccess: () => { toast.success('Marked delivered'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => storeApi.orders.cancel(id, cancelReason),
    onSuccess: () => { toast.success('Order cancelled'); setCancelOpen(false); setCancelReason(''); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const refund = useMutation({
    mutationFn: () =>
      storeApi.orders.refund(id, {
        amount_paise: refundAmount === '' ? undefined : inrToPaise(Number(refundAmount)),
        reason: refundReason,
      }),
    onSuccess: () => { toast.success('Refund initiated — settles on webhook'); setRefundOpen(false); setRefundAmount(''); setRefundReason(''); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const markReturned = useMutation({
    mutationFn: () => storeApi.orders.markReturned(id, restock),
    onSuccess: () => { toast.success('Marked returned'); setReturnOpen(false); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (order.isLoading) return <LoadingState />;
  if (order.isError || !order.data)
    return <ErrorState message={errorMessage(order.error)} onRetry={() => order.refetch()} />;

  const o = order.data;
  const actions = availableStoreActions(o.status, o.payment_status, o.shipment?.status ?? 'pending');
  const anyPending = pack.isPending || ship.isPending || deliver.isPending || cancel.isPending || refund.isPending || markReturned.isPending;

  const lineColumns: Column<StoreLineItem>[] = [
    {
      key: 'name',
      header: 'Item',
      render: (l) => (
        <div className="flex items-center gap-2">
          {l.image && <img src={l.image} alt="" className="h-8 w-8 rounded-chip border border-line object-cover" loading="lazy" />}
          <div>
            <div className="font-medium">{l.name}</div>
            <div className="text-xs text-ink-faint">{l.category}</div>
          </div>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (l) => l.qty },
    { key: 'unit', header: 'Unit', align: 'right', render: (l) => formatPaise(l.unit_price_paise) },
    { key: 'total', header: 'Line total', align: 'right', render: (l) => formatPaise(l.line_total_paise) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Placed ${dateTime(o.created_at)}`}
        title={`Order ${o.code}`}
        description={`${o.customer_name ?? ''}${o.customer_email ? ` · ${o.customer_email}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/store/orders')}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              All orders
            </Button>
            {actions.pack && (
              <Button disabled={anyPending} onClick={() => pack.mutate()}>
                <Package className="h-4 w-4" strokeWidth={1.5} />
                Mark packed
              </Button>
            )}
            {actions.ship && (
              <Button disabled={anyPending} onClick={() => setShipOpen(true)}>
                <Truck className="h-4 w-4" strokeWidth={1.5} />
                Ship
              </Button>
            )}
            {actions.deliver && (
              <Button disabled={anyPending} onClick={() => deliver.mutate()}>
                <PackageCheck className="h-4 w-4" strokeWidth={1.5} />
                Mark delivered
              </Button>
            )}
            {actions.markReturned && (
              <Button variant="secondary" disabled={anyPending} onClick={() => setReturnOpen(true)}>
                Mark returned
              </Button>
            )}
            {actions.refund && (
              <Button variant="secondary" disabled={anyPending} onClick={() => setRefundOpen(true)}>
                <IndianRupee className="h-4 w-4" strokeWidth={1.5} />
                Refund
              </Button>
            )}
            {actions.cancel && (
              <Button variant="danger" disabled={anyPending} onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" strokeWidth={1.5} />
                Cancel
              </Button>
            )}
          </div>
        }
      />

      {o.needs_reconciliation && (
        <div className="mb-4 flex items-start gap-3 rounded-card border border-danger/30 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <div>
            <span className="font-semibold">Needs reconciliation.</span>{' '}
            {o.reconciliation_reason ?? 'A payment/stock guard mismatched. Resolve with refund or cancel, plus a manual inventory adjustment if needed.'}
          </div>
        </div>
      )}

      <Card className="mb-4">
        <StoreStepper current={o.status} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card pad={false}>
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-display text-base leading-tight text-ink">Line items</h3>
            </div>
            <DataTable columns={lineColumns} rows={o.items ?? []} rowKey={(l) => l.store_product_id} emptyTitle="No items" />
            <div className="border-t border-line p-4">
              <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                <TotalRow label="Subtotal" paise={o.subtotal_paise} />
                {o.coupon_discount_paise > 0 && (
                  <TotalRow label={`Discount${o.coupon_code ? ` (${o.coupon_code})` : ''}`} paise={-o.coupon_discount_paise} />
                )}
                <TotalRow label="Shipping" paise={o.shipping_fee_paise} />
                <div className="flex items-center justify-between border-t border-line pt-1.5 text-base font-semibold">
                  <span>Total</span>
                  <span className="tnum">{formatPaise(o.total_paise)}</span>
                </div>
                {o.refund_total_paise > 0 && (
                  <div className="flex items-center justify-between pt-1 text-danger">
                    <span>Refunded</span>
                    <span className="tnum">{formatPaise(o.refund_total_paise)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Status history" />
            <ol className="space-y-3">
              {(o.status_history ?? []).map((h, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full bg-gold-ink" />
                    {i < (o.status_history?.length ?? 0) - 1 && <span className="mt-0.5 h-full w-px bg-line" />}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">
                      <StoreOrderStatusPill status={h.status} />
                      <span className="text-xs text-ink-faint tnum">{dateTime(h.at)}</span>
                    </div>
                    <div className="text-xs text-ink-faint">
                      by {h.by}{h.note ? `: ${h.note}` : ''}
                    </div>
                  </div>
                </li>
              ))}
              {(o.status_history?.length ?? 0) === 0 && <li className="text-sm text-ink-faint">No history yet.</li>}
            </ol>
          </Card>

          {(o.refund_events?.length ?? 0) > 0 && (
            <Card pad={false}>
              <div className="border-b border-line px-4 py-3">
                <h3 className="font-display text-base leading-tight text-ink">Refund events</h3>
              </div>
              <div className="divide-y divide-line">
                {o.refund_events.map((r) => (
                  <div key={r.refund_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="tnum text-ink-faint">{r.refund_id}</span>
                    <span className="flex items-center gap-3">
                      <Pill tone="neutral">{r.status}</Pill>
                      <span className="tnum font-medium">{formatPaise(r.amount_paise)}</span>
                      <span className="text-xs text-ink-faint">{dateTime(r.at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(o.payment_events?.length ?? 0) > 0 && (
            <Card pad={false}>
              <div className="border-b border-line px-4 py-3">
                <h3 className="font-display text-base leading-tight text-ink">Razorpay webhook events</h3>
              </div>
              <div className="divide-y divide-line">
                {o.payment_events.map((e) => (
                  <div key={e.event_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{e.event_type}</span>
                    <span className="flex items-center gap-3">
                      <Pill tone={e.processing_state === 'processed' ? 'success' : e.processing_state === 'error' ? 'danger' : 'neutral'}>
                        {e.processing_state}
                      </Pill>
                      <span className="text-xs text-ink-faint">{dateTime(e.received_at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Payment" />
            <dl className="space-y-2 text-sm">
              <Row label="Order status" value={<StoreOrderStatusPill status={o.status} />} />
              <Row label="Payment" value={<PaymentStatusPill status={o.payment_status} />} />
              <Row label="Provider" value={o.provider ?? 'razorpay'} />
              <Row label="Paid at" value={o.paid_at ? dateTime(o.paid_at) : '—'} />
              <Row label="Razorpay order" value={<Mono>{o.razorpay_order_id ?? '—'}</Mono>} />
              <Row label="Razorpay payment" value={<Mono>{o.razorpay_payment_id ?? '—'}</Mono>} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Shipment" />
            <dl className="space-y-2 text-sm">
              <Row label="Status" value={<ShipmentStatusPill status={o.shipment?.status ?? 'pending'} />} />
              <Row label="Courier" value={o.shipment?.courier ?? '—'} />
              <Row label="AWB" value={<Mono>{o.shipment?.awb ?? '—'}</Mono>} />
              <Row
                label="Tracking"
                value={
                  o.shipment?.tracking_url ? (
                    <a href={o.shipment.tracking_url} target="_blank" rel="noreferrer" className="text-gold-ink hover:underline">
                      Open
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <Row label="Shipped" value={o.shipment?.shipped_at ? dateTime(o.shipment.shipped_at) : '—'} />
              <Row label="Delivered" value={o.shipment?.delivered_at ? dateTime(o.shipment.delivered_at) : '—'} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Customer & shipping" />
            <div className="space-y-1 text-sm">
              {o.customer_id && (
                <Link className="text-gold-ink hover:underline" to={`/store/customers/${o.customer_id}`}>
                  {o.customer_name ?? 'Customer'}
                </Link>
              )}
              <div className="text-ink-faint">{o.customer_email}</div>
              <div className="mt-2 border-t border-line pt-2 text-ink-muted">
                <div className="font-medium text-ink">{o.shipping_address?.name}</div>
                <div>{o.shipping_address?.phone}</div>
                <div>{o.shipping_address?.line1}</div>
                {o.shipping_address?.line2 && <div>{o.shipping_address.line2}</div>}
                <div>
                  {o.shipping_address?.city}, {o.shipping_address?.state} {o.shipping_address?.pincode}
                </div>
              </div>
            </div>
          </Card>

          {o.notes && (
            <Card>
              <CardHeader title="Internal notes" />
              <p className="whitespace-pre-wrap text-sm text-ink-muted">{o.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Ship modal */}
      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title="Ship order"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShipOpen(false)}>Cancel</Button>
            <Button disabled={ship.isPending || !courier.trim() || !awb.trim()} onClick={() => ship.mutate()}>
              Mark shipped
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-chip border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">{STORE_ACTION_NOTE.ship}</div>
        <div className="space-y-3">
          <Field label="Courier" required>
            <input className="input" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery / BlueDart…" />
          </Field>
          <Field label="AWB / tracking number" required>
            <input className="input" value={awb} onChange={(e) => setAwb(e.target.value)} />
          </Field>
          <Field label="Tracking URL">
            <input className="input" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel order"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button variant="danger" disabled={cancel.isPending || !cancelReason.trim()} onClick={() => cancel.mutate()}>
              Cancel order
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-chip border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{STORE_ACTION_NOTE.cancel}</div>
        <Field label="Reason" required>
          <textarea className="input h-20 py-2" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </Field>
      </Modal>

      {/* Refund modal */}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Refund payment"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>Close</Button>
            <Button disabled={refund.isPending || !refundReason.trim()} onClick={() => refund.mutate()}>
              Initiate refund
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-chip border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{STORE_ACTION_NOTE.refund}</div>
        <div className="space-y-3">
          <Field label="Amount (₹)" hint={`Blank = full refund. Captured total ${formatPaise(o.total_paise)}.`}>
            <input className="input" type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Full refund" />
          </Field>
          <Field label="Reason" required>
            <textarea className="input h-20 py-2" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Mark-returned modal */}
      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Mark returned"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button disabled={markReturned.isPending} onClick={() => markReturned.mutate()}>
              Mark returned
            </Button>
          </>
        }
      >
        <div className="mb-3 rounded-chip border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">{STORE_ACTION_NOTE['mark-returned']}</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          Restock the returned units to available stock
        </label>
      </Modal>
    </div>
  );
}

function StoreStepper({ current }: { current: StoreOrderStatus }) {
  if (isStoreTerminal(current) && current !== 'delivered') {
    return (
      <div className="flex items-center gap-2">
        <StoreOrderStatusPill status={current} />
        <span className="text-xs text-ink-faint">This order is in a terminal off-path state.</span>
      </div>
    );
  }
  const idx = STORE_ORDER_FLOW.indexOf(current);
  return (
    <div className="flex items-center overflow-x-auto">
      {STORE_ORDER_FLOW.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1 px-1">
              <span
                className={clsx(
                  'tnum grid h-7 w-7 place-items-center rounded-full text-xs font-semibold',
                  active && 'bg-yellow text-ink',
                  done && 'bg-success/20 text-success',
                  !active && !done && 'bg-surface text-ink-faint',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : i + 1}
              </span>
              <span className={clsx('whitespace-nowrap text-[11px] capitalize', active ? 'font-semibold text-ink' : 'text-ink-faint')}>
                {s.replace(/_/g, ' ')}
              </span>
            </div>
            {i < STORE_ORDER_FLOW.length - 1 && (
              <span className={clsx('mx-1 h-px w-6 sm:w-10', i < idx ? 'bg-success' : 'bg-line')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TotalRow({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="flex items-center justify-between text-ink-faint">
      <span>{label}</span>
      <span className="tnum">{formatPaise(paise)}</span>
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

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="tnum text-xs">{children}</span>;
}
