import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { territories, users } from '@/api/client';
import type { UserInput } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import { ROLE_LABELS, roleLabel } from '@/auth/rbac';
import type { Role, User } from '@/api/types';

const PAGE_SIZE = 20;
const ROLES = Object.keys(ROLE_LABELS) as Role[];

const EMPTY: UserInput = {
  name: '',
  email: '',
  phone: '',
  role: 'fsr',
  territory_ids: [],
  status: 'active',
  password: '',
};

export function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<UserInput>(EMPTY);
  const [open, setOpen] = useState(false);

  const terrQuery = useQuery({ queryKey: ['territories'], queryFn: () => territories.list() });
  const query = useQuery({
    queryKey: ['users', { q: debouncedQ, role, page }],
    queryFn: () =>
      users.list({
        q: debouncedQ || undefined,
        role: role || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const save = useMutation({
    mutationFn: () => (editing ? users.update(editing.id, stripPassword(draft)) : users.create(draft)),
    onSuccess: () => {
      toast.success(editing ? 'User updated' : 'User created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY);
    setOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setDraft({
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      role: u.role,
      territory_ids: u.territory_ids ?? [],
      manager_id: u.manager_id ?? null,
      status: u.status,
    });
    setOpen(true);
  }

  const terrName = (id: string) =>
    terrQuery.data?.items.find((t) => t.id === id)?.name ?? id;

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div>
          <div className="font-medium">{u.name}</div>
          <div className="text-xs text-muted">{u.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <Pill tone="brand">{roleLabel(u.role)}</Pill> },
    { key: 'phone', header: 'Phone', render: (u) => u.phone ?? '—' },
    {
      key: 'terr',
      header: 'Territories',
      render: (u) =>
        u.territory_ids?.length ? (
          <span className="text-xs text-muted">{u.territory_ids.map(terrName).join(', ')}</span>
        ) : (
          <span className="text-xs text-muted">tenant-wide</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) =>
        u.status === 'active' ? <Pill tone="success">active</Pill> : <Pill tone="neutral">disabled</Pill>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => (
        <Button variant="ghost" className="h-7 px-2.5" onClick={(e) => { e.stopPropagation(); openEdit(u); }}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Staff accounts with role-based access and territory scope."
        actions={<Button onClick={openCreate}>+ New user</Button>}
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name / email…" />
            <Select
              value={role}
              onChange={(v) => { setRole(v); setPage(1); }}
              options={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
              placeholder="All roles"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(u) => u.id}
          loading={query.isLoading}
          onRowClick={openEdit}
          emptyTitle="No users"
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New user'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || !draft.name || !draft.email}
              onClick={() => save.mutate()}
            >
              {editing ? 'Save changes' : 'Create user'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={draft.status ?? 'active'}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as 'active' | 'disabled' })}
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
          {!editing && (
            <Field label="Temporary password" required>
              <input
                className="input"
                type="text"
                value={draft.password ?? ''}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="Organikally@123"
              />
            </Field>
          )}
          <div className="col-span-2">
            <Field label="Territories" hint="Leave empty for tenant-wide roles (finance / warehouse / admin)">
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-line p-2">
                {(terrQuery.data?.items ?? []).map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.territory_ids.includes(t.id)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          territory_ids: e.target.checked
                            ? [...draft.territory_ids, t.id]
                            : draft.territory_ids.filter((x) => x !== t.id),
                        })
                      }
                    />
                    {t.name} <span className="text-xs text-muted capitalize">({t.type})</span>
                  </label>
                ))}
                {(terrQuery.data?.items.length ?? 0) === 0 && (
                  <p className="text-xs text-muted">No territories defined yet.</p>
                )}
              </div>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function stripPassword(input: UserInput): Partial<UserInput> {
  const rest = { ...input };
  delete rest.password;
  return rest;
}
