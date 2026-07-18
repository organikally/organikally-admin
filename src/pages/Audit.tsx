import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { config as configApi } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Spinner } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill, AuditActionPill, AuditOutcomePill, StatusCodePill } from '@/components/ui/StatusPill';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { AuditDiff } from '@/components/audit/AuditDiff';
import { useToast } from '@/components/ui/Toast';
import { dateTime, fromNow } from '@/lib/format';
import { auditActionLabel, humanizeKey } from '@/lib/audit';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import { downloadBlob } from '@/lib/download';
import type { AuditLog, AuditLogQuery, AuditOutcome } from '@/api/types';

const PAGE_SIZE = 25;

// Curated SEEDS for the entity + action filters. These are UNIONED with every
// value that actually appears in the loaded results (see the effect below), so
// the dropdowns can never silently drift out of sync with the backend — a new
// event type surfaces automatically the moment one lands on a page. There is no
// distinct-values endpoint to fetch these from, hence the accumulate approach.
const SEED_ENTITIES = [
  'outlet', 'order', 'payment', 'sku', 'inventory', 'user',
  'territory', 'route', 'config', 'warehouse', 'visit',
];
const SEED_ACTIONS = [
  'outlet.create', 'outlet.update', 'outlet.approve', 'outlet.reject',
  'order.create', 'order.transition', 'order.cancel', 'order.credit_override',
  'payment.create', 'payment.collect',
  'sku.create', 'sku.update', 'inventory.create', 'inventory.update',
  'user.create', 'user.update', 'territory.create', 'route.create',
  'config.update', 'auth.login', 'auth.login_failed', 'auth.logout',
];

const OUTCOME_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

// Grow-only merge: returns the same reference when nothing is new, so the effect
// that calls it won't trigger an endless re-render loop.
function mergeSorted(prev: string[], next: (string | null | undefined)[]): string[] {
  const set = new Set(prev);
  let grew = false;
  for (const v of next) {
    if (v && !set.has(v)) {
      set.add(v);
      grew = true;
    }
  }
  return grew ? Array.from(set).sort() : prev;
}

export function AuditPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const debouncedQ = useDebounced(q, 300);
  const debouncedActor = useDebounced(actor, 300);

  const filters: AuditLogQuery = useMemo(
    () => ({
      q: debouncedQ || undefined,
      actor: debouncedActor || undefined,
      entity: entity || undefined,
      action: action || undefined,
      outcome: (outcome || undefined) as AuditOutcome | undefined,
      date_from: from || undefined,
      date_to: to || undefined,
    }),
    [debouncedQ, debouncedActor, entity, action, outcome, from, to],
  );

  const query = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => configApi.auditLogs({ ...filters, page, page_size: PAGE_SIZE }),
  });

  const [entityOpts, setEntityOpts] = useState<string[]>(SEED_ENTITIES);
  const [actionOpts, setActionOpts] = useState<string[]>(SEED_ACTIONS);
  useEffect(() => {
    const items = query.data?.items;
    if (!items?.length) return;
    setEntityOpts((prev) => mergeSorted(prev, items.map((i) => i.entity_type)));
    setActionOpts((prev) => mergeSorted(prev, items.map((i) => i.action)));
  }, [query.data]);

  async function onExport() {
    setExporting(true);
    try {
      const { blob, filename } = await configApi.auditLogsExport(filters);
      downloadBlob(blob, filename ?? `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export ready — check your downloads');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<AuditLog>[] = [
    {
      key: 'when',
      header: 'When',
      render: (l) => (
        <div>
          <div className="tnum text-xs font-medium text-ink">{dateTime(l.timestamp ?? l.created_at)}</div>
          <div className="text-[11px] text-ink-faint">{fromNow(l.timestamp ?? l.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (l) => {
        const name = l.actor_name || l.actor_email || (l.actor_id ? `#${l.actor_id.slice(-6)}` : 'System');
        const sub = l.actor_role ? humanizeKey(l.actor_role) : l.actor_name ? l.actor_email : null;
        return (
          <div className="min-w-0 max-w-[200px]">
            <div className="truncate text-xs font-medium text-ink">{name}</div>
            <div className="truncate text-[11px] text-ink-faint">{sub ?? '—'}</div>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (l) => <AuditActionPill action={l.action} outcome={l.outcome} />,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (l) =>
        l.outcome ? <AuditOutcomePill outcome={l.outcome} /> : <span className="text-[11px] text-ink-faint">—</span>,
    },
    {
      key: 'target',
      header: 'Entity / Endpoint',
      render: (l) => (
        <div className="min-w-0 max-w-[260px]">
          <div className="flex items-center gap-1.5">
            <Pill tone="neutral">{l.entity_type || 'request'}</Pill>
            {l.entity_id && <span className="tnum text-[11px] text-ink-faint">{l.entity_id.slice(-6)}</span>}
          </div>
          {(l.method || l.path) && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint">
              {l.method && <span className="tnum font-semibold">{l.method}</span>}
              {l.path && <span className="tnum truncate">{l.path}</span>}
              <StatusCodePill code={l.status_code} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (l) => <span className="tnum text-[11px] text-ink-faint">{l.ip ?? '—'}</span>,
    },
    {
      key: 'view',
      header: '',
      align: 'right',
      render: (l) => (
        <Button
          variant="ghost"
          className="h-7 px-2.5"
          onClick={(e) => {
            e.stopPropagation();
            setDetail(l);
          }}
        >
          Diff
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable record of who changed what, when, and from where. Filter, inspect the field-level diff, and export for record-keeping."
        actions={
          <Button variant="secondary" onClick={onExport} disabled={exporting}>
            {exporting ? <Spinner /> : <Download className="h-4 w-4" strokeWidth={1.5} />}
            Export CSV
          </Button>
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Search action, entity, ID…"
            />
            <SearchInput
              value={actor}
              onChange={(v) => {
                setActor(v);
                setPage(1);
              }}
              placeholder="Actor name / email…"
            />
            <Select
              value={entity}
              onChange={(v) => {
                setEntity(v);
                setPage(1);
              }}
              options={entityOpts.map((e) => ({ value: e, label: e }))}
              placeholder="All entities"
            />
            <Select
              value={action}
              onChange={(v) => {
                setAction(v);
                setPage(1);
              }}
              options={actionOpts.map((a) => ({ value: a, label: a }))}
              placeholder="All actions"
            />
            <Select
              value={outcome}
              onChange={(v) => {
                setOutcome(v);
                setPage(1);
              }}
              options={OUTCOME_OPTIONS}
              placeholder="Any outcome"
            />
            <div className="flex items-center gap-1 text-xs text-ink-faint">
              <input
                type="date"
                className="input w-auto"
                value={from}
                aria-label="From date"
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
              <span>to</span>
              <input
                type="date"
                className="input w-auto"
                value={to}
                aria-label="To date"
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(l) => l.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={setDetail}
          emptyTitle="No audit entries"
          emptyHint="Adjust the search, actor, action, outcome or date filters to see more."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        size="lg"
        title={detail ? `${auditActionLabel(detail.action)} · ${detail.entity_type || 'request'}` : ''}
        footer={
          <Button variant="ghost" onClick={() => setDetail(null)}>
            Close
          </Button>
        }
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <AuditActionPill action={detail.action} outcome={detail.outcome} />
              {detail.outcome && <AuditOutcomePill outcome={detail.outcome} />}
              {detail.source && <Pill tone="neutral">{detail.source}</Pill>}
              {detail.status_code != null && <StatusCodePill code={detail.status_code} />}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-chip border border-line bg-surface p-3 text-xs sm:grid-cols-3">
              <Meta label="Actor" value={detail.actor_name || detail.actor_email || detail.actor_id} />
              <Meta label="Role" value={detail.actor_role ? humanizeKey(detail.actor_role) : '—'} />
              <Meta label="When" value={dateTime(detail.timestamp ?? detail.created_at)} />
              {detail.actor_email && <Meta label="Email" value={detail.actor_email} />}
              <Meta label="Entity ID" value={detail.entity_id || '—'} />
              <Meta label="IP" value={detail.ip ?? '—'} />
              {(detail.method || detail.path) && (
                <Meta label="Endpoint" value={[detail.method, detail.path].filter(Boolean).join(' ')} full />
              )}
            </div>

            <AuditDiff log={detail} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function Meta({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2 sm:col-span-3' : ''}>
      <div className="text-ink-faint">{label}</div>
      <div className="tnum break-all font-medium text-ink">{value || '—'}</div>
    </div>
  );
}
