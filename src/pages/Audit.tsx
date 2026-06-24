import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { config as configApi } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { AuditLog } from '@/api/types';

const PAGE_SIZE = 25;
const ENTITY_OPTIONS = [
  'outlet',
  'order',
  'payment',
  'sku',
  'inventory',
  'user',
  'territory',
  'config',
  'route',
].map((e) => ({ value: e, label: e }));

export function AuditPage() {
  const [entity, setEntity] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const debouncedActor = useDebounced(actor, 300);

  const query = useQuery({
    queryKey: ['audit', { entity, actor: debouncedActor, page }],
    queryFn: () =>
      configApi.auditLogs({
        entity: entity || undefined,
        actor: debouncedActor || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<AuditLog>[] = [
    { key: 'time', header: 'When', render: (l) => dateTime(l.timestamp ?? l.created_at) },
    {
      key: 'actor',
      header: 'Actor',
      render: (l) => l.actor_name ?? l.actor_id,
    },
    {
      key: 'action',
      header: 'Action',
      render: (l) => <span className="font-medium">{l.action}</span>,
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (l) => (
        <div className="flex items-center gap-1.5">
          <Pill tone="neutral">{l.entity_type}</Pill>
          <span className="text-xs text-ink-faint tnum">{l.entity_id?.slice(-6)}</span>
        </div>
      ),
    },
    { key: 'ip', header: 'IP', render: (l) => <span className="text-xs text-ink-faint tnum">{l.ip ?? '-'}</span> },
    {
      key: 'view',
      header: '',
      align: 'right',
      render: (l) => (
        <Button variant="ghost" className="h-7 px-2.5" onClick={(e) => { e.stopPropagation(); setDetail(l); }}>
          Diff
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable record of who changed what. Click a row to inspect the before/after diff."
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={actor} onChange={(v) => { setActor(v); setPage(1); }} placeholder="Filter by actor…" />
            <Select
              value={entity}
              onChange={(v) => { setEntity(v); setPage(1); }}
              options={ENTITY_OPTIONS}
              placeholder="All entities"
            />
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
          emptyHint="Adjust the actor or entity filter to see more."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.action} · ${detail.entity_type}` : ''}
        footer={
          <Button variant="ghost" onClick={() => setDetail(null)}>
            Close
          </Button>
        }
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Meta label="Actor" value={detail.actor_name ?? detail.actor_id} />
              <Meta label="When" value={dateTime(detail.timestamp ?? detail.created_at)} />
              <Meta label="Entity ID" value={detail.entity_id} />
              <Meta label="IP" value={detail.ip ?? '-'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label">Before</div>
                <pre className="tnum max-h-64 overflow-auto rounded-chip border border-line bg-surface p-2 text-[11px] leading-relaxed">
                  {detail.before ? JSON.stringify(detail.before, null, 2) : '-'}
                </pre>
              </div>
              <div>
                <div className="label">After</div>
                <pre className="tnum max-h-64 overflow-auto rounded-chip border border-line bg-surface p-2 text-[11px] leading-relaxed">
                  {detail.after ? JSON.stringify(detail.after, null, 2) : '-'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-ink-faint">{label}: </span>
      <span className="font-medium tnum">{value}</span>
    </div>
  );
}
