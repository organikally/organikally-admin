import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { outlets } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { OutletManageModal } from '@/components/outlets/OutletManageModal';
import { ClassPill, OutletStatusPill } from '@/components/ui/StatusPill';
import { dateShort, fromNow, money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { Outlet } from '@/api/types';

const PAGE_SIZE = 20;

export function ApprovalsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [manageTarget, setManageTarget] = useState<Outlet | null>(null);

  // Reps self-onboard instantly, so new outlets land as `active`. This queue is
  // for reviewing them (set credit limit / class) and cleaning up duplicates.
  const recent = useQuery({
    queryKey: ['outlets', 'review', page],
    queryFn: () =>
      outlets.list({ status: 'active', sort: '-created_at', page, page_size: PAGE_SIZE }),
  });

  // Legacy: outlets created before instant onboarding may still sit as
  // pending_approval. Surface them if any so they can be actioned.
  const pending = useQuery({
    queryKey: ['outlets', 'pending'],
    queryFn: () => outlets.pending({ page_size: PAGE_SIZE }),
  });

  const columns: Column<Outlet>[] = [
    {
      key: 'name',
      header: 'Outlet',
      render: (o) => (
        <div>
          <div className="font-medium">{o.name}</div>
          <div className="text-xs text-ink-faint tnum">{o.code}</div>
        </div>
      ),
    },
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
    { key: 'type', header: 'Shop type', render: (o) => o.profile?.shop_type ?? '-' },
    { key: 'class', header: 'Class', render: (o) => <ClassPill outletClass={o.outlet_class} /> },
    { key: 'credit', header: 'Credit limit', align: 'right', render: (o) => money(o.credit_limit) },
    {
      key: 'onboarded',
      header: 'Onboarded',
      render: (o) => (
        <div className="text-sm">
          <div>{dateShort(o.created_at)}</div>
          <div className="text-xs text-ink-faint">{fromNow(o.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-7 px-2.5" onClick={() => navigate(`/outlets/${o.id}`)}>
            Open
          </Button>
          <Button className="h-7 px-2.5" onClick={() => setManageTarget(o)}>
            Manage
          </Button>
        </div>
      ),
    },
  ];

  const pendingCount = pending.data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Outlet Review"
        description="Reps onboard outlets instantly — they go live and can be sold to right away. Review new outlets here to set credit limits and class, or deactivate a bad or duplicate one."
      />

      {/* Legacy pending outlets, if any remain from before instant onboarding. */}
      {pendingCount > 0 && (
        <Card className="mb-4" pad={false}>
          <div className="border-b border-line px-4 py-3">
            <CardHeader
              title="Legacy pending outlets"
              subtitle="Created before instant onboarding. Manage them to set live or deactivate."
            />
          </div>
          <DataTable
            columns={[
              ...columns.slice(0, 4),
              { key: 'status', header: 'Status', render: (o) => <OutletStatusPill status={o.status} /> },
              columns[columns.length - 1],
            ]}
            rows={pending.data?.items ?? []}
            rowKey={(o) => o.id}
            loading={pending.isLoading}
            error={pending.isError ? errorMessage(pending.error) : null}
            onRetry={() => pending.refetch()}
            onRowClick={(o) => navigate(`/outlets/${o.id}`)}
            emptyTitle="None pending"
            emptyHint="No legacy pending outlets."
          />
        </Card>
      )}

      <Card pad={false}>
        <div className="border-b border-line px-4 py-3">
          <CardHeader
            title="Recently onboarded outlets"
            subtitle="Newest self-onboarded outlets in your territory scope."
          />
        </div>
        <DataTable
          columns={columns}
          rows={recent.data?.items ?? []}
          rowKey={(o) => o.id}
          loading={recent.isLoading}
          error={recent.isError ? errorMessage(recent.error) : null}
          onRetry={() => recent.refetch()}
          onRowClick={(o) => navigate(`/outlets/${o.id}`)}
          emptyTitle="No outlets yet"
          emptyHint="Outlets reps onboard in the field will appear here for review."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={recent.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      <OutletManageModal
        open={!!manageTarget}
        outlet={manageTarget}
        onClose={() => setManageTarget(null)}
      />
    </div>
  );
}
