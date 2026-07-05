import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { formatPaise, num, dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import type { Coupon, CouponInput, CouponScope, CouponType } from '@/api/types';

const PAGE_SIZE = 20;

interface CouponForm {
  code: string;
  type: CouponType;
  percent_off: string;
  amount_off: string; // INR
  max_discount: string; // INR
  min_order_value: string; // INR
  applies_to: CouponScope;
  category: string;
  product_ids: string; // comma-separated
  starts_at: string;
  ends_at: string;
  usage_limit: string;
  usage_limit_per_customer: string;
  active: boolean;
  description: string;
}

const EMPTY: CouponForm = {
  code: '',
  type: 'percent',
  percent_off: '10',
  amount_off: '',
  max_discount: '',
  min_order_value: '',
  applies_to: 'all',
  category: '',
  product_ids: '',
  starts_at: '',
  ends_at: '',
  usage_limit: '',
  usage_limit_per_customer: '',
  active: true,
  description: '',
};

function toForm(c: Coupon): CouponForm {
  // Prefer the view's INR companions; fall back to deriving from paise.
  const amountOff = c.amount_off ?? (c.amount_off_paise != null ? c.amount_off_paise / 100 : null);
  const maxDiscount = c.max_discount ?? (c.max_discount_paise != null ? c.max_discount_paise / 100 : null);
  const minOrder = c.min_order_value ?? (c.min_order_value_paise ? c.min_order_value_paise / 100 : 0);
  return {
    code: c.code,
    type: c.type,
    percent_off: c.percent_off != null ? String(c.percent_off) : '',
    amount_off: amountOff != null ? String(amountOff) : '',
    max_discount: maxDiscount != null ? String(maxDiscount) : '',
    min_order_value: minOrder ? String(minOrder) : '',
    applies_to: c.applies_to,
    category: c.category ?? '',
    product_ids: (c.product_ids ?? []).join(', '),
    starts_at: c.starts_at ? c.starts_at.slice(0, 16) : '',
    ends_at: c.ends_at ? c.ends_at.slice(0, 16) : '',
    usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
    usage_limit_per_customer: c.usage_limit_per_customer != null ? String(c.usage_limit_per_customer) : '',
    active: c.active,
    description: c.description ?? '',
  };
}

function toInput(f: CouponForm): CouponInput {
  // Coupon endpoints speak INR on input; the backend converts to paise.
  return {
    code: f.code.trim().toUpperCase(),
    type: f.type,
    percent_off: f.type === 'percent' ? Number(f.percent_off) || 0 : null,
    amount_off: f.type === 'fixed' ? Number(f.amount_off) : null,
    max_discount: f.type === 'percent' && f.max_discount !== '' ? Number(f.max_discount) : null,
    min_order_value: f.min_order_value === '' ? 0 : Number(f.min_order_value),
    applies_to: f.applies_to,
    category: f.applies_to === 'category' ? f.category.trim() || null : null,
    product_ids: f.applies_to === 'product' ? f.product_ids.split(',').map((s) => s.trim()).filter(Boolean) : [],
    starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null,
    ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
    usage_limit: f.usage_limit === '' ? null : Number(f.usage_limit),
    usage_limit_per_customer: f.usage_limit_per_customer === '' ? null : Number(f.usage_limit_per_customer),
    active: f.active,
    description: f.description.trim() || null,
  };
}

function couponValue(c: Coupon): string {
  if (c.type === 'percent') return `${c.percent_off ?? 0}% off`;
  if (c.type === 'fixed') return `${formatPaise(c.amount_off_paise ?? 0)} off`;
  return 'Free shipping';
}

export function StoreCouponsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['store', 'coupons', { q: debouncedQ, active, page }],
    queryFn: () =>
      storeApi.coupons.list({
        q: debouncedQ || undefined,
        active: active === '' ? undefined : active === 'true',
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const save = useMutation({
    mutationFn: () => (editing ? storeApi.coupons.update(editing.id, toInput(form)) : storeApi.coupons.create(toInput(form))),
    onSuccess: () => {
      toast.success(editing ? 'Coupon updated' : 'Coupon created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['store', 'coupons'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (c: Coupon) => storeApi.coupons.remove(c.id),
    onSuccess: () => {
      toast.success('Coupon deactivated');
      qc.invalidateQueries({ queryKey: ['store', 'coupons'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(c: Coupon) {
    setEditing(c);
    setForm(toForm(c));
    setOpen(true);
  }
  function patch<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <div>
          <div className="font-medium tnum">{c.code}</div>
          {c.description && <div className="text-xs text-ink-faint">{c.description}</div>}
        </div>
      ),
    },
    { key: 'value', header: 'Reward', render: (c) => couponValue(c) },
    {
      key: 'scope',
      header: 'Scope',
      render: (c) => (
        <span className="text-xs text-ink-faint">
          {c.applies_to === 'all' ? 'All products' : c.applies_to === 'category' ? `Category: ${c.category}` : `${c.product_ids?.length ?? 0} products`}
        </span>
      ),
    },
    { key: 'min', header: 'Min order', align: 'right', render: (c) => (c.min_order_value_paise ? formatPaise(c.min_order_value_paise) : '—') },
    {
      key: 'usage',
      header: 'Used',
      align: 'right',
      render: (c) => (
        <span className="tnum">
          {num(c.used_count)}
          {c.usage_limit != null ? ` / ${num(c.usage_limit)}` : ''}
        </span>
      ),
    },
    { key: 'window', header: 'Ends', render: (c) => (c.ends_at ? dateShort(c.ends_at) : 'No expiry') },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (c.active ? <Pill tone="success">active</Pill> : <Pill tone="neutral">inactive</Pill>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" className="h-7 px-2.5" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
            Edit
          </Button>
          {c.active && (
            <Button
              variant="ghost"
              className="h-7 px-2.5 text-danger"
              disabled={remove.isPending}
              onClick={(e) => { e.stopPropagation(); if (confirm(`Deactivate ${c.code}?`)) remove.mutate(c); }}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Percent / fixed / free-shipping discounts with scope, spend thresholds, validity windows and usage caps."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" strokeWidth={1.5} />New coupon</Button>}
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search code…" />
            <Select
              value={active}
              onChange={(v) => { setActive(v); setPage(1); }}
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
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
          onRowClick={openEdit}
          emptyTitle="No coupons"
          emptyHint="Create a discount code to run a promotion."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={save.isPending || !form.code.trim()} onClick={() => save.mutate()}>
              {editing ? 'Save changes' : 'Create coupon'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code" required>
            <input className="input uppercase" value={form.code} onChange={(e) => patch('code', e.target.value.toUpperCase())} placeholder="WELCOME10" />
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => patch('type', e.target.value as CouponType)}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </Field>

          {form.type === 'percent' && (
            <>
              <Field label="Percent off (%)" required>
                <input className="input" type="number" min={0} max={100} value={form.percent_off} onChange={(e) => patch('percent_off', e.target.value)} />
              </Field>
              <Field label="Max discount (₹)" hint="Optional cap">
                <input className="input" type="number" min={0} step="0.01" value={form.max_discount} onChange={(e) => patch('max_discount', e.target.value)} />
              </Field>
            </>
          )}
          {form.type === 'fixed' && (
            <Field label="Amount off (₹)" required>
              <input className="input" type="number" min={0} step="0.01" value={form.amount_off} onChange={(e) => patch('amount_off', e.target.value)} />
            </Field>
          )}

          <Field label="Min order value (₹)" hint="Tested against the whole subtotal">
            <input className="input" type="number" min={0} step="0.01" value={form.min_order_value} onChange={(e) => patch('min_order_value', e.target.value)} />
          </Field>
          <Field label="Applies to">
            <select className="input" value={form.applies_to} onChange={(e) => patch('applies_to', e.target.value as CouponScope)}>
              <option value="all">All products</option>
              <option value="category">A category</option>
              <option value="product">Specific products</option>
            </select>
          </Field>

          {form.applies_to === 'category' && (
            <div className="col-span-2">
              <Field label="Category" required>
                <input className="input" value={form.category} onChange={(e) => patch('category', e.target.value)} placeholder="Oils" />
              </Field>
            </div>
          )}
          {form.applies_to === 'product' && (
            <div className="col-span-2">
              <Field label="Product IDs" required hint="Comma-separated store_product ids">
                <input className="input" value={form.product_ids} onChange={(e) => patch('product_ids', e.target.value)} />
              </Field>
            </div>
          )}

          <Field label="Starts at">
            <input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => patch('starts_at', e.target.value)} />
          </Field>
          <Field label="Ends at">
            <input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => patch('ends_at', e.target.value)} />
          </Field>
          <Field label="Total usage limit" hint="Blank = unlimited">
            <input className="input" type="number" min={0} value={form.usage_limit} onChange={(e) => patch('usage_limit', e.target.value)} />
          </Field>
          <Field label="Per-customer limit" hint="Blank = unlimited">
            <input className="input" type="number" min={0} value={form.usage_limit_per_customer} onChange={(e) => patch('usage_limit_per_customer', e.target.value)} />
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              <input className="input" value={form.description} onChange={(e) => patch('description', e.target.value)} />
            </Field>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => patch('active', e.target.checked)} />
            Active
          </label>
        </div>
      </Modal>
    </div>
  );
}
