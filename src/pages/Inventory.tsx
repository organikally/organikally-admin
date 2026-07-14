import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { inventory, skus, warehouses } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar, Select } from '@/components/ui/Filters';
import { num } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { Inventory as Inv } from '@/api/types';

const PAGE_SIZE = 25;

export function InventoryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can('inventory_edit');

  // Warehouse + low-stock live in the URL so they are deep-linkable: the
  // `inventory.low_stock` notification links to /inventory?warehouse=<id>&low=1
  // and must land on exactly the rows that triggered the alert. Reading them
  // from the query string (rather than mirroring into state) also means a link
  // clicked while already on this page re-filters instead of doing nothing.
  const [params, setParams] = useSearchParams();
  const warehouse = params.get('warehouse') ?? '';
  const lowOnly = params.get('low') === '1';
  const [page, setPage] = useState(1);

  function patchFilters(next: { warehouse?: string; low?: boolean }) {
    const p = new URLSearchParams(params);
    if (next.warehouse !== undefined) {
      if (next.warehouse) p.set('warehouse', next.warehouse);
      else p.delete('warehouse');
    }
    if (next.low !== undefined) {
      if (next.low) p.set('low', '1');
      else p.delete('low');
    }
    setParams(p, { replace: true });
    setPage(1);
  }
  const [editing, setEditing] = useState<Inv | null>(null);
  const [qtyAvailable, setQtyAvailable] = useState('');
  const [reorder, setReorder] = useState('');

  // Opening-stock (POST /inventory) state — the fix for SKUs that have no row
  // in a warehouse yet and are therefore un-orderable.
  const [stockOpen, setStockOpen] = useState(false);
  const [stockWarehouse, setStockWarehouse] = useState('');
  const [stockSku, setStockSku] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [stockReorder, setStockReorder] = useState('');

  const whQuery = useQuery({ queryKey: ['warehouses'], queryFn: warehouses.list });

  const query = useQuery({
    queryKey: ['inventory', { warehouse, lowOnly, page }],
    queryFn: () =>
      inventory.list({
        warehouse_id: warehouse || undefined,
        low_stock: lowOnly || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const save = useMutation({
    mutationFn: () =>
      inventory.update(editing!.id, {
        qty_available: Number(qtyAvailable),
        reorder_level: Number(reorder),
      }),
    onSuccess: () => {
      toast.success('Inventory updated');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // SKU list + this warehouse's existing rows drive the "no row yet" picker.
  const skuQuery = useQuery({
    queryKey: ['skus', 'stockable'],
    queryFn: () => skus.list({ active: true, page_size: 500 }),
    enabled: stockOpen,
  });
  const existingQuery = useQuery({
    queryKey: ['inventory', 'existing', stockWarehouse],
    queryFn: () => inventory.list({ warehouse_id: stockWarehouse, page_size: 500 }),
    enabled: stockOpen && !!stockWarehouse,
  });

  const availableSkus = useMemo(() => {
    const taken = new Set((existingQuery.data?.items ?? []).map((r) => r.sku_id));
    return (skuQuery.data?.items ?? []).filter((s) => !taken.has(s.id));
  }, [skuQuery.data, existingQuery.data]);

  const addStock = useMutation({
    mutationFn: () =>
      inventory.create({
        sku_id: stockSku,
        warehouse_id: stockWarehouse,
        qty_available: Number(stockQty),
        reorder_point: stockReorder === '' ? null : Number(stockReorder),
      }),
    onSuccess: () => {
      toast.success('Opening stock added');
      setStockOpen(false);
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openStock() {
    setStockWarehouse(warehouse || '');
    setStockSku('');
    setStockQty('');
    setStockReorder('');
    setStockOpen(true);
  }

  function openEdit(inv: Inv) {
    setEditing(inv);
    setQtyAvailable(String(inv.qty_available));
    setReorder(String(inv.reorder_level));
  }

  function stockState(inv: Inv): 'out' | 'low' | 'ok' {
    if (inv.qty_available <= 0) return 'out';
    if (inv.qty_available <= inv.reorder_level) return 'low';
    return 'ok';
  }

  const columns: Column<Inv>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (i) => (
        <div>
          <div className="font-medium">{i.sku_name ?? i.sku_id}</div>
          {i.sku_code && <div className="text-xs text-ink-faint tnum">{i.sku_code}</div>}
        </div>
      ),
    },
    { key: 'wh', header: 'Warehouse', render: (i) => i.warehouse_name ?? (i.warehouse_id ? `WH ${i.warehouse_id.slice(-6)}` : '-') },
    { key: 'available', header: 'Available', align: 'right', render: (i) => num(i.qty_available) },
    { key: 'reserved', header: 'Reserved', align: 'right', render: (i) => num(i.qty_reserved) },
    { key: 'reorder', header: 'Reorder level', align: 'right', render: (i) => num(i.reorder_level) },
    {
      key: 'state',
      header: 'State',
      render: (i) => {
        const s = stockState(i);
        return s === 'out' ? (
          <Pill tone="danger">out of stock</Pill>
        ) : s === 'low' ? (
          <Pill tone="warning">low</Pill>
        ) : (
          <Pill tone="success">in stock</Pill>
        );
      },
    },
  ];

  if (canEdit) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (i) => (
        <Button variant="ghost" className="h-7 px-2.5" onClick={(e) => { e.stopPropagation(); openEdit(i); }}>
          Adjust
        </Button>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Per-warehouse stock: available, reserved and reorder levels. Stock is reserved on order, decremented on dispatch."
        actions={
          canEdit ? (
            <Button onClick={openStock}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Add opening stock
            </Button>
          ) : undefined
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <Select
              value={warehouse}
              onChange={(v) => patchFilters({ warehouse: v })}
              options={(whQuery.data?.items ?? []).map((w) => ({ value: w.id, label: w.name }))}
              placeholder="All warehouses"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => patchFilters({ low: e.target.checked })}
              />
              Low / out of stock only
            </label>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(i) => i.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={canEdit ? openEdit : undefined}
          emptyTitle="No inventory rows"
          emptyHint="Try a different warehouse or clear the low-stock filter."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Adjust ${editing?.sku_name ?? 'stock'}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editing && (
            <div className="rounded-chip bg-surface px-3 py-2 text-xs text-ink-faint tnum">
              Reserved: {editing.qty_reserved} (cannot edit, managed by orders)
            </div>
          )}
          <Field label="Available quantity">
            <input className="input" type="number" min={0} value={qtyAvailable} onChange={(e) => setQtyAvailable(e.target.value)} />
          </Field>
          <Field label="Reorder level">
            <input className="input" type="number" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        title="Add opening stock"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStockOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={addStock.isPending || !stockWarehouse || !stockSku || stockQty === ''}
              onClick={() => addStock.mutate()}
            >
              Add stock
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-chip bg-surface px-3 py-2 text-xs text-ink-faint">
            Creates the first inventory row for a SKU in a warehouse so it becomes orderable. Use
            &ldquo;Adjust&rdquo; on the table for rows that already exist.
          </p>
          <Field label="Warehouse" required>
            <select
              className="input"
              value={stockWarehouse}
              onChange={(e) => {
                setStockWarehouse(e.target.value);
                setStockSku('');
              }}
            >
              <option value="">Select warehouse…</option>
              {(whQuery.data?.items ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="SKU" required hint="Only SKUs without a row in this warehouse are listed.">
            <select
              className="input"
              value={stockSku}
              disabled={!stockWarehouse}
              onChange={(e) => setStockSku(e.target.value)}
            >
              <option value="">
                {!stockWarehouse
                  ? 'Select a warehouse first'
                  : skuQuery.isLoading || existingQuery.isLoading
                    ? 'Loading SKUs…'
                    : availableSkus.length === 0
                      ? 'Every SKU is already stocked here'
                      : 'Select SKU…'}
              </option>
              {availableSkus.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Opening quantity" required>
            <input
              className="input"
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
            />
          </Field>
          <Field label="Reorder point" hint="Optional. Low-stock alerts fire at or below this level.">
            <input
              className="input"
              type="number"
              min={0}
              value={stockReorder}
              onChange={(e) => setStockReorder(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
