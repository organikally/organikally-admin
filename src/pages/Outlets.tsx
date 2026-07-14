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
import { MapPanel } from '@/components/map/MapPanel';
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

  /**
   * The map is NOT the list. The list is paginated (20 a page, as before); the map
   * plots every outlet in territory scope via the non-paginated `/outlets/geo`
   * feed. Plotting only the current page — which is what this screen used to do —
   * showed a manager 20 pins out of 500 and called it a map.
   *
   * Fetched only when the map view is actually open, and cached by react-query, so
   * list-only users never pay for the geo payload. The same q/status filters apply,
   * so what you filter is what you see, in either view.
   */
  const geo = useQuery({
    queryKey: ['outlets', 'geo', { q: debouncedQ, status }],
    queryFn: () =>
      outlets.geo({
        q: debouncedQ || undefined,
        status: (status || undefined) as OutletStatus | undefined,
      }),
    enabled: view === 'map',
    staleTime: 60_000,
  });

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
            <MapPanel
              outlets={geo.data?.items ?? []}
              height={560}
              loading={geo.isLoading}
              error={geo.isError ? errorMessage(geo.error) : null}
              onRetry={() => geo.refetch()}
              total={geo.data?.total}
              truncated={geo.data?.truncated}
              withoutCoords={geo.data?.without_coords ?? 0}
              onOutletClick={(id) => navigate(`/outlets/${id}`)}
              // Re-fit the viewport when the filters change (the result set is a
              // different place on the earth), never on a background refetch.
              fitKey={`${debouncedQ}|${status}`}
              emptyTitle={q || status ? 'No outlets match these filters' : 'No outlets yet'}
              emptyHint={
                q || status
                  ? 'Try a broader search or clear the status filter.'
                  : 'Outlets appear here as soon as reps onboard them with a location.'
              }
            />
            {geo.data && !geo.isError && (
              <p className="mt-2 text-xs text-ink-faint">
                Plotting <span className="tnum font-medium text-ink">{geo.data.returned.toLocaleString('en-IN')}</span>{' '}
                {geo.data.returned === 1 ? 'outlet' : 'outlets'} across your whole territory scope —
                not just this page.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
