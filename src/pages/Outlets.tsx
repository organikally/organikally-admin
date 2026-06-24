import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { outlets } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { ClassPill, OutletStatusPill } from '@/components/ui/StatusPill';
import { MiniMap } from '@/components/ui/MiniMap';
import type { MapMarker } from '@/components/ui/MiniMap';
import { money, dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { Outlet, OutletStatus } from '@/api/types';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  'prospect',
  'pending_approval',
  'active',
  'dormant',
  'churned',
  'rejected',
].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }));

export function OutletsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'list' | 'map'>('list');
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['outlets', { q: debouncedQ, status, page }],
    queryFn: () =>
      outlets.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as OutletStatus | undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const rows = useMemo(() => query.data?.items ?? [], [query.data]);

  const markers: MapMarker[] = useMemo(
    () =>
      rows
        .filter((o) => o.location?.coordinates)
        .map((o) => ({
          id: o.id,
          point: o.location,
          label: o.name,
          tone: o.status === 'active' ? 'brand' : o.status === 'pending_approval' ? 'gold' : 'muted',
        })),
    [rows],
  );

  const columns: Column<Outlet>[] = [
    {
      key: 'name',
      header: 'Outlet',
      render: (o) => (
        <div>
          <div className="font-medium text-ink">{o.name}</div>
          <div className="text-xs text-ink-faint tnum">{o.code}</div>
        </div>
      ),
    },
    { key: 'class', header: 'Class', render: (o) => <ClassPill outletClass={o.outlet_class} /> },
    { key: 'status', header: 'Status', render: (o) => <OutletStatusPill status={o.status} /> },
    {
      key: 'owner',
      header: 'Owner',
      render: (o) => (
        <div className="text-sm">
          <div>{o.profile?.owner_name ?? '-'}</div>
          <div className="text-xs text-ink-faint">{o.profile?.owner_phone ?? ''}</div>
        </div>
      ),
    },
    { key: 'credit', header: 'Credit limit', align: 'right', render: (o) => money(o.credit_limit) },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: (o) => (
        <span className={o.outstanding > 0 ? 'text-danger font-medium' : ''}>
          {money(o.outstanding)}
        </span>
      ),
    },
    { key: 'last_order', header: 'Last order', render: (o) => dateShort(o.last_order_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Outlets"
        description="All outlets in your territory scope, searchable, filterable, mapped."
        actions={
          <div className="flex rounded-pill border border-line p-0.5">
            {(['list', 'map'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={
                  'cursor-pointer rounded-pill px-3 py-1 text-sm font-medium capitalize transition-colors ' +
                  (view === v ? 'bg-yellow text-ink' : 'text-ink-faint hover:text-ink')
                }
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name / code / owner…" />
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
          </FilterBar>
        </div>

        {view === 'list' ? (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(o) => o.id}
              loading={query.isLoading}
              error={query.isError ? errorMessage(query.error) : null}
              onRetry={() => query.refetch()}
              onRowClick={(o) => navigate(`/outlets/${o.id}`)}
              emptyTitle="No outlets match"
              emptyHint="Try a different search or status filter."
            />
            <div className="border-t border-line px-2">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={query.data?.total ?? 0}
                onPage={setPage}
              />
            </div>
          </>
        ) : (
          <div className="p-3">
            <MiniMap markers={markers} height={520} onSelect={(id) => navigate(`/outlets/${id}`)} />
            <p className="mt-2 text-xs text-ink-faint">
              Showing <span className="tnum">{markers.length}</span> located outlets on this page. Click a marker to open the
              outlet.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
