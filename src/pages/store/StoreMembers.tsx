import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { MembershipStatusPill } from '@/components/ui/StatusPill';
import { num, dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { MembershipAdmin, MembershipStatus } from '@/api/types';

const PAGE_SIZE = 20;

export function StoreMembersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'memberships', { q: debouncedQ, status, page }],
    queryFn: () =>
      storeApi.memberships.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as MembershipStatus | undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<MembershipAdmin>[] = [
    {
      key: 'customer',
      header: 'Member',
      render: (m) => (
        <div>
          <div className="font-medium">{m.customer?.name ?? '—'}</div>
          <div className="text-xs text-ink-faint">{m.customer?.email}</div>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', render: (m) => m.plan_name },
    { key: 'status', header: 'Status', render: (m) => <MembershipStatusPill status={m.status} /> },
    {
      key: 'expires',
      header: 'Expiry',
      render: (m) =>
        m.expires_at ? (
          <div>
            <div>{dateShort(m.expires_at)}</div>
            {typeof m.days_remaining === 'number' && (
              <div className="text-xs text-ink-faint tnum">
                {m.days_remaining > 0 ? `${num(m.days_remaining)} days left` : 'expired'}
              </div>
            )}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'coins',
      header: 'Wallet',
      align: 'right',
      render: (m) => <span className="tnum">{num(m.wallet_balance_coins ?? 0)} coins</span>,
    },
    { key: 'created', header: 'Joined', render: (m) => dateShort(m.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Members"
        description="Organikaly Club members: plan, status, expiry and coin-wallet balance. PII handled per DPDP 2023."
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
              placeholder="Search name / email…"
            />
            <Select
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              placeholder="Any status"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(m) => m.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={(m) => navigate(`/store/members/${m.id}`)}
          emptyTitle="No members"
          emptyHint="No Organikaly Club members match this filter."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
