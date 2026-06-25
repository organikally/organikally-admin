import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventory, warehouses } from '@/api/client';
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

  const [warehouse, setWarehouse] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Inv | null>(null);
  const [qtyAvailable, setQtyAvailable] = useState('');
  const [reorder, setReorder] = useState('');

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
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <Select
              value={warehouse}
              onChange={(v) => { setWarehouse(v); setPage(1); }}
              options={(whQuery.data?.items ?? []).map((w) => ({ value: w.id, label: w.name }))}
              placeholder="All warehouses"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }}
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
    </div>
  );
}
