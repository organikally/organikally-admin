import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analytics } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/charts/KpiCard';
import { AgingPie, CoverageLineChart, SalesBarChart, SimpleBar } from '@/components/charts/Charts';
import { Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Filters';
import { money, moneyCompact, pct, num } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import type { SalesGroupRow } from '@/api/types';

type GroupBy = 'sku' | 'rep' | 'region' | 'category';

export function DashboardPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>('sku');

  const summary = useQuery({ queryKey: ['analytics', 'summary'], queryFn: analytics.summary });
  const sales = useQuery({
    queryKey: ['analytics', 'sales', groupBy],
    queryFn: () => analytics.sales({ group_by: groupBy }),
  });
  const coverage = useQuery({ queryKey: ['analytics', 'coverage'], queryFn: analytics.coverage });
  const aging = useQuery({
    queryKey: ['analytics', 'receivables-aging'],
    queryFn: analytics.receivablesAging,
  });

  const salesChart = useMemo(
    () =>
      (sales.data?.rows ?? []).slice(0, 8).map((r) => ({
        label: r.label,
        current: r.current,
        prior: r.prior,
      })),
    [sales.data],
  );

  const agingChart = useMemo(
    () => (aging.data?.buckets ?? []).map((b) => ({ label: b.bucket, value: b.total })),
    [aging.data],
  );

  const salesColumns: Column<SalesGroupRow>[] = [
    { key: 'label', header: groupBy.toUpperCase(), render: (r) => <span className="font-medium">{r.label}</span> },
    { key: 'current', header: 'Current', align: 'right', render: (r) => money(r.current) },
    { key: 'prior', header: 'Prior', align: 'right', render: (r) => money(r.prior) },
    {
      key: 'growth',
      header: 'Growth',
      align: 'right',
      render: (r) => (
        <span className={r.growth_pct >= 0 ? 'text-success' : 'text-danger'}>
          {r.growth_pct >= 0 ? '+' : ''}
          {pct(r.growth_pct, 1)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Coverage, strike-rate, sales and receivables, scoped to your role and territory."
      />

      {/* KPI cards */}
      {summary.isLoading ? (
        <LoadingState />
      ) : summary.isError ? (
        <ErrorState message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : (
        summary.data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Coverage"
              value={pct(summary.data.coverage_pct, 1)}
              sub="Visit compliance MTD"
              growth={growth(summary.data.coverage_pct, summary.data.coverage_prev_pct)}
            />
            <KpiCard
              label="Strike Rate"
              value={pct(summary.data.strike_rate_pct, 1)}
              sub="Orders / visits"
              growth={growth(summary.data.strike_rate_pct, summary.data.strike_rate_prev_pct)}
            />
            <KpiCard
              label="Sales MTD"
              value={moneyCompact(summary.data.sales_mtd)}
              sub="Booked order value"
              growth={growth(summary.data.sales_mtd, summary.data.sales_prev)}
              tone="gold"
            />
            <KpiCard
              label="Outstanding"
              value={moneyCompact(summary.data.outstanding_total)}
              sub={
                summary.data.outstanding_overdue !== undefined
                  ? `${moneyCompact(summary.data.outstanding_overdue)} overdue`
                  : 'Receivables'
              }
              tone="danger"
            />
          </div>
        )
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Sales by group */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Sales vs. prior period"
            subtitle="Booked order value, compared to the previous comparable window"
            action={
              <Select
                value={groupBy}
                onChange={(v) => setGroupBy(v as GroupBy)}
                options={[
                  { value: 'sku', label: 'By SKU' },
                  { value: 'rep', label: 'By Rep' },
                  { value: 'region', label: 'By Region' },
                  { value: 'category', label: 'By Category' },
                ]}
              />
            }
          />
          {sales.isLoading ? (
            <LoadingState />
          ) : sales.isError ? (
            <ErrorState message={errorMessage(sales.error)} onRetry={() => sales.refetch()} />
          ) : (
            <>
              <SalesBarChart data={salesChart} />
              <div className="mt-3 border-t border-line pt-2">
                <DataTable
                  columns={salesColumns}
                  rows={sales.data?.rows ?? []}
                  rowKey={(r) => r.key}
                  emptyTitle="No sales in range"
                />
              </div>
            </>
          )}
        </Card>

        {/* Receivables aging */}
        <Card>
          <CardHeader title="Receivables aging" subtitle="Outstanding by bucket" />
          {aging.isLoading ? (
            <LoadingState />
          ) : aging.isError ? (
            <ErrorState message={errorMessage(aging.error)} onRetry={() => aging.refetch()} />
          ) : (
            <>
              <AgingPie data={agingChart} />
              <div className="mt-2 space-y-1.5">
                {(aging.data?.buckets ?? []).map((b) => (
                  <div key={b.bucket} className="flex items-center justify-between text-sm">
                    <span className="text-ink-faint">{b.bucket} days</span>
                    <span className="tnum font-medium">{money(b.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-line pt-1.5 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tnum">{money(aging.data?.total_outstanding)}</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Coverage trend */}
        <Card>
          <CardHeader
            title="Coverage trend"
            subtitle={
              coverage.data
                ? `Overall ${pct(coverage.data.overall_coverage_pct, 1)} · outlet coverage ${pct(coverage.data.outlet_coverage_pct, 1)}`
                : 'Visit compliance over time'
            }
          />
          {coverage.isLoading ? (
            <LoadingState />
          ) : coverage.isError ? (
            <ErrorState message={errorMessage(coverage.error)} onRetry={() => coverage.refetch()} />
          ) : (
            <CoverageLineChart data={coverage.data?.series ?? []} />
          )}
        </Card>

        {/* Coverage by rep */}
        <Card>
          <CardHeader title="Coverage by rep" subtitle="Visited vs. planned" />
          {coverage.isLoading ? (
            <LoadingState />
          ) : (
            <SimpleBar
              data={(coverage.data?.by_rep ?? []).map((r) => ({
                label: r.rep_name,
                value: Number(r.coverage_pct.toFixed(1)),
              }))}
              valueFormatter={(v) => `${v}%`}
            />
          )}
        </Card>
      </div>

      {summary.data && (summary.data.active_outlets || summary.data.pending_approvals) ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Active outlets" value={num(summary.data.active_outlets)} />
          <MiniStat label="Pending approvals" value={num(summary.data.pending_approvals)} />
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="tnum mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function growth(current?: number, prior?: number): number | null {
  if (current === undefined || prior === undefined || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}
