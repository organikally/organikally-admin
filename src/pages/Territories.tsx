import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { territories, users } from '@/api/client';
import type { TerritoryInput } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { Territory, TerritoryType } from '@/api/types';

interface TreeNode extends Territory {
  children: TreeNode[];
}

const EMPTY: TerritoryInput = { name: '', parent_id: null, type: 'region', assigned_user_ids: [] };

export function TerritoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Territory | null>(null);
  const [draft, setDraft] = useState<TerritoryInput>(EMPTY);

  const query = useQuery({ queryKey: ['territories'], queryFn: () => territories.list() });
  const userQuery = useQuery({ queryKey: ['users', 'all'], queryFn: () => users.list({ page_size: 100 }) });

  const tree = useMemo(() => buildTree(query.data?.items ?? []), [query.data]);

  const save = useMutation({
    mutationFn: () =>
      editing ? territories.update(editing.id, draft) : territories.create(draft),
    onSuccess: () => {
      toast.success(editing ? 'Territory updated' : 'Territory created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['territories'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate(parent?: Territory) {
    setEditing(null);
    setDraft({
      ...EMPTY,
      parent_id: parent?.id ?? null,
      type: parent ? childType(parent.type) : 'region',
    });
    setOpen(true);
  }
  function openEdit(t: Territory) {
    setEditing(t);
    setDraft({
      name: t.name,
      parent_id: t.parent_id ?? null,
      type: t.type,
      assigned_user_ids: t.assigned_user_ids ?? [],
    });
    setOpen(true);
  }

  const userName = (id: string) => userQuery.data?.items.find((u) => u.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Territories and Beats"
        description="Region, Area, Beat hierarchy. Reps and managers are scoped to these."
        actions={<Button onClick={() => openCreate()}><Plus className="h-4 w-4" strokeWidth={1.5} />New region</Button>}
      />

      <Card>
        <CardHeader title="Hierarchy" subtitle="Click a node to edit, or add a child territory" />
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : tree.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No territories yet.</p>
        ) : (
          <div className="space-y-1">
            {tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                onEdit={openEdit}
                onAddChild={openCreate}
                userName={userName}
              />
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New territory'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending || !draft.name} onClick={() => save.mutate()}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Type">
            <select
              className="input"
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as TerritoryType })}
            >
              <option value="region">Region</option>
              <option value="area">Area</option>
              <option value="beat">Beat</option>
            </select>
          </Field>
          <Field label="Parent territory">
            <select
              className="input"
              value={draft.parent_id ?? ''}
              onChange={(e) => setDraft({ ...draft, parent_id: e.target.value || null })}
            >
              <option value="">None (top-level)</option>
              {(query.data?.items ?? [])
                .filter((t) => t.id !== editing?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Assigned users">
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-chip border border-line p-2">
              {(userQuery.data?.items ?? []).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.assigned_user_ids?.includes(u.id) ?? false}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        assigned_user_ids: e.target.checked
                          ? [...(draft.assigned_user_ids ?? []), u.id]
                          : (draft.assigned_user_ids ?? []).filter((x) => x !== u.id),
                      })
                    }
                  />
                  {u.name} <span className="text-xs text-ink-faint">({u.role})</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  onEdit,
  onAddChild,
  userName,
}: {
  node: TreeNode;
  depth: number;
  onEdit: (t: Territory) => void;
  onAddChild: (t: Territory) => void;
  userName: (id: string) => string;
}) {
  return (
    <>
      <div
        className="group flex items-center justify-between rounded-chip px-2 py-2 transition-colors hover:bg-surface"
        style={{ paddingLeft: 8 + depth * 22 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{node.name}</span>
          <Pill tone={node.type === 'region' ? 'success' : node.type === 'area' ? 'info' : 'warning'}>
            {node.type}
          </Pill>
          {node.assigned_user_ids?.length > 0 && (
            <span className="text-xs text-ink-faint">
              {node.assigned_user_ids.map(userName).join(', ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {node.type !== 'beat' && (
            <Button variant="ghost" className="h-6 px-2 text-xs" onClick={() => onAddChild(node)}>
              Add child
            </Button>
          )}
          <Button variant="ghost" className="h-6 px-2 text-xs" onClick={() => onEdit(node)}>
            Edit
          </Button>
        </div>
      </div>
      {node.children.map((c) => (
        <TreeRow key={c.id} node={c} depth={depth + 1} onEdit={onEdit} onAddChild={onAddChild} userName={userName} />
      ))}
    </>
  );
}

function buildTree(items: Territory[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  items.forEach((t) => byId.set(t.id, { ...t, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function childType(type: TerritoryType): TerritoryType {
  return type === 'region' ? 'area' : 'beat';
}
