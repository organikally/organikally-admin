import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { skus } from '@/api/client';
import type { SkuInput } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { Plus } from 'lucide-react';
import { money, pct } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import { useAuth } from '@/auth/AuthContext';
import type { Sku } from '@/api/types';

const PAGE_SIZE = 20;

const EMPTY: SkuInput = {
  name: '',
  code: '',
  category: '',
  pack_size: '',
  unit: 'pc',
  mrp: 0,
  ptr: 0,
  ptd: 0,
  moq: 1,
  hsn: '',
  gst_rate: 0,
  active: true,
};

export function CatalogPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can('catalog_edit');

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const [editing, setEditing] = useState<Sku | null>(null);
  const [draft, setDraft] = useState<SkuInput>(EMPTY);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['skus', { q: debouncedQ, category, active, page }],
    queryFn: () =>
      skus.list({
        q: debouncedQ || undefined,
        category: category || undefined,
        active: active === '' ? undefined : active === 'true',
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const save = useMutation({
    mutationFn: () => (editing ? skus.update(editing.id, draft) : skus.create(draft)),
    onSuccess: () => {
      toast.success(editing ? 'SKU updated' : 'SKU created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['skus'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY);
    setOpen(true);
  }
  function openEdit(s: Sku) {
    setEditing(s);
    setDraft({
      name: s.name,
      code: s.code,
      category: s.category,
      pack_size: s.pack_size,
      unit: s.unit,
      mrp: s.mrp,
      ptr: s.ptr,
      ptd: s.ptd,
      moq: s.moq,
      hsn: s.hsn,
      gst_rate: s.gst_rate,
      image_url: s.image_url,
      active: s.active,
    });
    setOpen(true);
  }

  const columns: Column<Sku>[] = [
    {
      key: 'name',
      header: 'SKU',
      render: (s) => (
        <div>
          <div className="font-medium">{s.name}</div>
          <div className="text-xs text-ink-faint tnum">{s.code} · {s.pack_size}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (s) => s.category },
    { key: 'mrp', header: 'MRP', align: 'right', render: (s) => money(s.mrp) },
    { key: 'ptr', header: 'PTR', align: 'right', render: (s) => money(s.ptr) },
    { key: 'ptd', header: 'PTD', align: 'right', render: (s) => money(s.ptd) },
    { key: 'gst', header: 'GST', align: 'right', render: (s) => pct(s.gst_rate) },
    { key: 'moq', header: 'MOQ', align: 'right', render: (s) => s.moq },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (s.active ? <Pill tone="success">active</Pill> : <Pill tone="neutral">inactive</Pill>),
    },
  ];

  if (canEdit) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <Button variant="ghost" className="h-7 px-2.5" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>
          Edit
        </Button>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="SKUs / Catalog"
        description="Product master with MRP / PTR / PTD pricing, GST and MOQ."
        actions={canEdit && <Button onClick={openCreate}><Plus className="h-4 w-4" strokeWidth={1.5} />New SKU</Button>}
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name / code…" />
            <Select
              value={category}
              onChange={(v) => { setCategory(v); setPage(1); }}
              options={categoryOptions(query.data?.items ?? [])}
              placeholder="All categories"
            />
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
          rowKey={(s) => s.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={canEdit ? openEdit : undefined}
          emptyTitle="No SKUs"
          emptyHint={canEdit ? 'Create your first SKU.' : 'No products match this filter.'}
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New SKU'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending || !draft.name || !draft.code} onClick={() => save.mutate()}>
              {editing ? 'Save changes' : 'Create SKU'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Name" required>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
          </div>
          <Field label="Code" required>
            <input className="input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </Field>
          <Field label="Category">
            <input className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          </Field>
          <Field label="Pack size">
            <input className="input" value={draft.pack_size} onChange={(e) => setDraft({ ...draft, pack_size: e.target.value })} placeholder="1L / 1kg" />
          </Field>
          <Field label="Unit">
            <input className="input" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          </Field>
          <Field label="MRP (₹)">
            <input className="input" type="number" value={draft.mrp} onChange={(e) => setDraft({ ...draft, mrp: Number(e.target.value) })} />
          </Field>
          <Field label="PTR, price to retailer (₹)">
            <input className="input" type="number" value={draft.ptr} onChange={(e) => setDraft({ ...draft, ptr: Number(e.target.value) })} />
          </Field>
          <Field label="PTD, price to distributor (₹)">
            <input className="input" type="number" value={draft.ptd} onChange={(e) => setDraft({ ...draft, ptd: Number(e.target.value) })} />
          </Field>
          <Field label="GST rate (%)">
            <input className="input" type="number" value={draft.gst_rate} onChange={(e) => setDraft({ ...draft, gst_rate: Number(e.target.value) })} />
          </Field>
          <Field label="HSN code">
            <input className="input" value={draft.hsn} onChange={(e) => setDraft({ ...draft, hsn: e.target.value })} />
          </Field>
          <Field label="MOQ">
            <input className="input" type="number" min={1} value={draft.moq} onChange={(e) => setDraft({ ...draft, moq: Number(e.target.value) })} />
          </Field>
          <div className="col-span-2">
            <Field label="Image URL">
              <input className="input" value={draft.image_url ?? ''} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active ?? true}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Active (orderable)
          </label>
        </div>
      </Modal>
    </div>
  );
}

function categoryOptions(items: Sku[]): { value: string; label: string }[] {
  const cats = Array.from(new Set(items.map((s) => s.category).filter(Boolean)));
  return cats.map((c) => ({ value: c, label: c }));
}
