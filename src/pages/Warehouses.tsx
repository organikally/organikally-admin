import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { territories, warehouses } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { Warehouse } from '@/api/types';

interface WarehouseDraft {
  name: string;
  code: string;
  territory_id: string;
}

const EMPTY: WarehouseDraft = { name: '', code: '', territory_id: '' };

export function WarehousesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can('inventory_edit');

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WarehouseDraft>(EMPTY);

  const query = useQuery({ queryKey: ['warehouses'], queryFn: warehouses.list });
  const terrQuery = useQuery({ queryKey: ['territories'], queryFn: () => territories.list() });

  const save = useMutation({
    mutationFn: () =>
      warehouses.create({
        name: draft.name.trim(),
        code: draft.code.trim(),
        territory_id: draft.territory_id || undefined,
      }),
    onSuccess: () => {
      toast.success('Warehouse created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate() {
    setDraft(EMPTY);
    setOpen(true);
  }

  const terrName = (id?: string | null) =>
    (id && terrQuery.data?.items.find((t) => t.id === id)?.name) || null;

  const columns: Column<Warehouse>[] = [
    {
      key: 'name',
      header: 'Warehouse',
      render: (w) => (
        <div>
          <div className="font-medium">{w.name}</div>
          <div className="text-xs text-ink-faint tnum">{w.code}</div>
        </div>
      ),
    },
    {
      key: 'territory',
      header: 'Territory',
      render: (w) =>
        terrName(w.territory_id) ? (
          <span className="text-sm">{terrName(w.territory_id)}</span>
        ) : (
          <span className="text-xs text-ink-faint">tenant-wide</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Warehouses"
        description="Stocking locations that hold inventory. Every SKU's opening stock and dispatch is booked against a warehouse."
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              New warehouse
            </Button>
          ) : undefined
        }
      />

      <Card pad={false}>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(w) => w.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          emptyTitle="No warehouses yet"
          emptyHint={
            canEdit
              ? 'Create a warehouse before adding opening stock in Inventory.'
              : 'No stocking locations have been configured.'
          }
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New warehouse"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || !draft.name.trim() || !draft.code.trim()}
              onClick={() => save.mutate()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Pune Central DC"
            />
          </Field>
          <Field label="Code" required hint="Short unique identifier used on dispatch documents">
            <input
              className="input"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
              placeholder="e.g. PUN-DC1"
            />
          </Field>
          <Field label="Territory" hint="Optional. Leave empty for a tenant-wide warehouse.">
            <select
              className="input"
              value={draft.territory_id}
              onChange={(e) => setDraft({ ...draft, territory_id: e.target.value })}
            >
              <option value="">None (tenant-wide)</option>
              {(terrQuery.data?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
