import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowUp, ArrowDown, X } from 'lucide-react';
import { outlets, routes, territories, users } from '@/api/client';
import type { RouteInput } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import type { Outlet, Route as RouteModel } from '@/api/types';

// Backend PJP days follow Python's weekday(): Monday = 0 .. Sunday = 6.
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayLabel = (d?: number | null) => (d != null && DAYS[d]) || 'Unscheduled';

interface RouteDraft {
  name: string;
  rep_id: string;
  territory_id: string;
  day_of_week: number | null;
  active: boolean;
  outlet_ids: string[];
}

const EMPTY: RouteDraft = {
  name: '',
  rep_id: '',
  territory_id: '',
  day_of_week: 0,
  active: true,
  outlet_ids: [],
};

export function RoutesPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [repFilter, setRepFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RouteModel | null>(null);
  const [draft, setDraft] = useState<RouteDraft>(EMPTY);
  const [outletSearch, setOutletSearch] = useState('');
  const debouncedSearch = useDebounced(outletSearch, 300);

  const query = useQuery({
    queryKey: ['routes', { repFilter, dayFilter }],
    queryFn: () =>
      routes.list({
        rep_id: repFilter || undefined,
        day: dayFilter ? Number(dayFilter) : undefined,
      }),
  });

  // Rep + territory directories power the pickers and the id -> name columns.
  // These are territory-scoped server-side; a role without directory access
  // simply sees empty pickers (the page itself is gated by manage_routes).
  const userQuery = useQuery({ queryKey: ['users', 'reps'], queryFn: () => users.list({ page_size: 200 }) });
  const terrQuery = useQuery({ queryKey: ['territories'], queryFn: () => territories.list() });

  // Outlet reference list (name resolution for saved routes) + live search picker.
  const outletRefQuery = useQuery({
    queryKey: ['outlets', 'route-ref'],
    queryFn: () => outlets.list({ page_size: 200 }),
  });
  const outletSearchQuery = useQuery({
    queryKey: ['outlets', 'route-search', debouncedSearch],
    queryFn: () => outlets.list({ q: debouncedSearch || undefined, page_size: 25 }),
    enabled: open,
  });

  const reps = useMemo(
    () => (userQuery.data?.items ?? []).filter((u) => u.role === 'fsr' || u.role === 'asm'),
    [userQuery.data],
  );
  const repName = (id: string) => userQuery.data?.items.find((u) => u.id === id)?.name ?? id;
  const terrName = (id: string) => terrQuery.data?.items.find((t) => t.id === id)?.name ?? id;

  const outletNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of outletRefQuery.data?.items ?? []) m.set(o.id, o.name);
    for (const o of outletSearchQuery.data?.items ?? []) m.set(o.id, o.name);
    return m;
  }, [outletRefQuery.data, outletSearchQuery.data]);
  const outletName = (id: string) => outletNames.get(id) ?? `Outlet ${id.slice(-6)}`;

  const save = useMutation({
    mutationFn: () => {
      const body: RouteInput = {
        name: draft.name.trim(),
        rep_id: draft.rep_id,
        territory_id: draft.territory_id,
        outlet_ids: draft.outlet_ids,
        active: draft.active,
        ...(draft.day_of_week != null ? { day_of_week: draft.day_of_week } : {}),
      };
      return editing ? routes.update(editing.id, body) : routes.create(body);
    },
    onSuccess: () => {
      toast.success(editing ? 'Route updated' : 'Route created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY);
    setOutletSearch('');
    setOpen(true);
  }
  function openEdit(r: RouteModel) {
    setEditing(r);
    setDraft({
      name: r.name,
      rep_id: r.rep_id,
      territory_id: r.territory_id,
      day_of_week: r.day_of_week ?? null,
      active: r.active,
      outlet_ids: r.outlet_ids ?? [],
    });
    setOutletSearch('');
    setOpen(true);
  }

  function addOutlet(o: Outlet) {
    setDraft((d) => (d.outlet_ids.includes(o.id) ? d : { ...d, outlet_ids: [...d.outlet_ids, o.id] }));
  }
  function removeOutlet(id: string) {
    setDraft((d) => ({ ...d, outlet_ids: d.outlet_ids.filter((x) => x !== id) }));
  }
  function move(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const arr = [...d.outlet_ids];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...d, outlet_ids: arr };
    });
  }

  const searchResults = (outletSearchQuery.data?.items ?? []).filter(
    (o) => !draft.outlet_ids.includes(o.id),
  );
  const canSave =
    !save.isPending &&
    !!draft.name.trim() &&
    !!draft.rep_id &&
    !!draft.territory_id &&
    draft.outlet_ids.length > 0;

  const columns: Column<RouteModel>[] = [
    {
      key: 'name',
      header: 'Route',
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-ink-faint">{terrName(r.territory_id)}</div>
        </div>
      ),
    },
    { key: 'rep', header: 'Rep', render: (r) => repName(r.rep_id) },
    {
      key: 'day',
      header: 'Day',
      render: (r) => <Pill tone={r.day_of_week != null ? 'info' : 'neutral'}>{dayLabel(r.day_of_week)}</Pill>,
    },
    { key: 'stops', header: 'Stops', align: 'right', render: (r) => r.outlet_ids?.length ?? 0 },
    {
      key: 'active',
      header: 'Status',
      render: (r) => (r.active ? <Pill tone="success">active</Pill> : <Pill tone="neutral">inactive</Pill>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <Button variant="ghost" className="h-7 px-2.5" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Routes / PJP"
        description="Permanent journey plans: each route is a rep's ordered list of outlets for a given day. Reps pull their day's plan from these."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            New route
          </Button>
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <Select
              value={repFilter}
              onChange={setRepFilter}
              options={reps.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="All reps"
            />
            <Select
              value={dayFilter}
              onChange={setDayFilter}
              options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
              placeholder="All days"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={openEdit}
          emptyTitle="No routes yet"
          emptyHint="Create a route so reps get a daily journey plan and /routes/today returns their stops."
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New route'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={() => save.mutate()}>
              {editing ? 'Save changes' : 'Create route'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Route name" required>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Kothrud Mon"
            />
          </Field>
          <Field label="Rep" required>
            <select
              className="input"
              value={draft.rep_id}
              onChange={(e) => setDraft({ ...draft, rep_id: e.target.value })}
            >
              <option value="">Select rep…</option>
              {reps.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Territory" required>
            <select
              className="input"
              value={draft.territory_id}
              onChange={(e) => setDraft({ ...draft, territory_id: e.target.value })}
            >
              <option value="">Select territory…</option>
              {(terrQuery.data?.items ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Day of week">
            <select
              className="input"
              value={draft.day_of_week ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, day_of_week: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">Unscheduled</option>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>

          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              Active (reps only pull active routes)
            </label>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-3">
            {/* Ordered journey plan */}
            <Field label={`Journey plan (${draft.outlet_ids.length} stops, in order)`}>
              <div className="min-h-[9rem] space-y-1 rounded-chip border border-line p-2">
                {draft.outlet_ids.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-faint">
                    Add outlets from the right — order is the visit sequence.
                  </p>
                ) : (
                  draft.outlet_ids.map((id, idx) => (
                    <div key={id} className="flex items-center gap-1.5 rounded-chip bg-surface px-2 py-1.5">
                      <span className="tnum w-5 text-center text-xs text-ink-faint">{idx + 1}</span>
                      <span className="flex-1 truncate text-sm">{outletName(id)}</span>
                      <button
                        type="button"
                        className="grid h-6 w-6 place-items-center rounded-chip text-ink-faint hover:bg-paper hover:text-ink disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        className="grid h-6 w-6 place-items-center rounded-chip text-ink-faint hover:bg-paper hover:text-ink disabled:opacity-30"
                        disabled={idx === draft.outlet_ids.length - 1}
                        onClick={() => move(idx, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        className="grid h-6 w-6 place-items-center rounded-chip text-ink-faint hover:bg-paper hover:text-danger"
                        onClick={() => removeOutlet(id)}
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Field>

            {/* Outlet picker */}
            <Field label="Add outlets">
              <div className="space-y-2">
                <SearchInput
                  value={outletSearch}
                  onChange={setOutletSearch}
                  placeholder="Search outlets…"
                />
                <div className="max-h-[7.5rem] space-y-1 overflow-y-auto rounded-chip border border-line p-2">
                  {outletSearchQuery.isLoading ? (
                    <p className="py-4 text-center text-xs text-ink-faint">Searching…</p>
                  ) : searchResults.length === 0 ? (
                    <p className="py-4 text-center text-xs text-ink-faint">No outlets found.</p>
                  ) : (
                    searchResults.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-chip px-2 py-1.5 text-left text-sm hover:bg-surface"
                        onClick={() => addOutlet(o)}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={1.5} />
                        <span className="flex-1 truncate">{o.name}</span>
                        <span className="text-xs text-ink-faint tnum">{o.code}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
