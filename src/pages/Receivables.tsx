import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payments } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { AgingPie } from '@/components/charts/Charts';
import { ReceivablePill } from '@/components/ui/StatusPill';
import { FilterBar, Select } from '@/components/ui/Filters';
import { dateShort, money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { Payment, PaymentMethod, ReceivableStatus } from '@/api/types';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: { value: ReceivableStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

export function ReceivablesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canCollect = can('receivables_edit');

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [collectTarget, setCollectTarget] = useState<Payment | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');

  const aging = useQuery({ queryKey: ['receivables', 'aging'], queryFn: payments.aging });
  const list = useQuery({
    queryKey: ['payments', { status, page }],
    queryFn: () =>
      payments.list({
        status: status || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const collect = useMutation({
    mutationFn: () =>
      payments.collect(collectTarget!.id, {
        amount: Number(amount),
        method,
        reference: reference || undefined,
      }),
    onSuccess: () => {
      toast.success('Collection recorded');
      setCollectTarget(null);
      setAmount('');
      setReference('');
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const agingChart = useMemo(
    () => (aging.data?.buckets ?? []).map((b) => ({ label: `${b.bucket} days`, value: b.total })),
    [aging.data],
  );

  const columns: Column<Payment>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (p) =>
        p.order_id ? (
          <Link to={`/orders/${p.order_id}`} className="font-medium text-gold-ink hover:underline tnum">
            {p.order_code ?? p.order_id.slice(-6)}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'outlet',
      header: 'Outlet',
      render: (p) =>
        p.outlet_id ? (
          <Link to={`/outlets/${p.outlet_id}`} className="hover:underline">
            {p.outlet_name ?? p.outlet_id}
          </Link>
        ) : (
          p.outlet_name ?? '-'
        ),
    },
    { key: 'type', header: 'Type', render: (p) => <span className="capitalize">{p.type}</span> },
    { key: 'collected', header: 'Collected', align: 'right', render: (p) => money(p.amount_collected) },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (p) => (
        <span className={p.balance > 0 ? 'font-medium text-danger' : ''}>{money(p.balance)}</span>
      ),
    },
    { key: 'due', header: 'Due', render: (p) => dateShort(p.due_date) },
    { key: 'status', header: 'Status', render: (p) => <ReceivablePill status={p.status} /> },
  ];

  if (canCollect) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) =>
        p.balance > 0 ? (
          <Button
            variant="ghost"
            className="h-7 px-2.5"
            onClick={(e) => {
              e.stopPropagation();
              setCollectTarget(p);
              setAmount(String(p.balance));
              setMethod('cash');
              setReference('');
            }}
          >
            Collect
          </Button>
        ) : (
          <span className="text-xs text-ink-faint">settled</span>
        ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Payments and Receivables"
        description="Outstanding by aging bucket, with reconciliation. Record-keeping only, no live gateway."
      />

      {/* Aging buckets */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader title="Aging mix" />
          {aging.isLoading ? (
            <LoadingState />
          ) : aging.isError ? (
            <ErrorState message={errorMessage(aging.error)} onRetry={() => aging.refetch()} />
          ) : (
            <AgingPie data={agingChart} height={200} />
          )}
        </Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-3">
          {(aging.data?.buckets ?? []).map((b) => (
            <div
              key={b.bucket}
              className={
                'card p-4 ' +
                (b.bucket === '60+' ? 'border-danger/30' : b.bucket === '31-60' ? 'border-warning/40' : '')
              }
            >
              <div className="eyebrow">{b.bucket} days</div>
              <div className="tnum mt-1 text-2xl font-semibold">{money(b.total)}</div>
              <div className="mt-1 text-xs text-ink-faint tnum">{b.count} accounts</div>
            </div>
          ))}
          <div className="panel flex flex-col justify-center p-4 sm:col-span-3">
            <div className="eyebrow">Total outstanding</div>
            <div className="tnum mt-1 text-2xl font-semibold text-success">
              {money(aging.data?.total_outstanding)}
            </div>
          </div>
        </div>
      </div>

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(p) => p.id}
          loading={list.isLoading}
          error={list.isError ? errorMessage(list.error) : null}
          onRetry={() => list.refetch()}
          emptyTitle="No receivables"
          emptyHint="Receivables raised on invoiced orders will show here."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={!!collectTarget}
        onClose={() => setCollectTarget(null)}
        title="Record collection"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCollectTarget(null)}>
              Cancel
            </Button>
            <Button disabled={!amount || Number(amount) <= 0 || collect.isPending} onClick={() => collect.mutate()}>
              Record
            </Button>
          </>
        }
      >
        {collectTarget && (
          <div className="mb-3 rounded-chip bg-surface px-3 py-2 text-xs text-ink-faint tnum">
            Balance due: {money(collectTarget.balance)} · {collectTarget.outlet_name}
          </div>
        )}
        <div className="space-y-3">
          <Field label="Amount (₹)" required>
            <input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
            </select>
          </Field>
          <Field label="Reference" hint="UPI ref / cheque no.">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
