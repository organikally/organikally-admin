import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analytics } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiCard } from '@/components/charts/KpiCard';
import {
  AgingPie,
  CoverageLineChart,
  SalesBarChart,
  SimpleBar,
  StrikeRateLineChart,
} from '@/components/charts/Charts';
import { Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Filters';
import { money, moneyCompact, pct, num } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import type { SalesGroupRow, StrikeRateRow } from '@/api/types';

type GroupBy = 'sku' | 'rep' | 'region' | 'category';

export function DashboardPage() {
  const [groupBy, setGroupBy] = useState<GroupBy>('sku');
  const { can } = useAuth();

  const summary = useQuery({ queryKey: ['analytics', 'summary'], queryFn: analytics.summary });
  const sales = useQuery({
    queryKey: ['analytics', 'sales', groupBy],
    queryFn: () => analytics.sales({ group_by: groupBy }),
  });
  const coverage = useQuery({ queryKey: ['analytics', 'coverage'], queryFn: analytics.coverage });
  const strike = useQuery({
    queryKey: ['analytics', 'strike-rate'],
    queryFn: analytics.strikeRate,
  });
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

  const coverageByRep = useMemo(
    () =>
      (coverage.data?.by_rep ?? []).map((r) => ({
        label: r.rep_name,
        value: Number(r.coverage_pct.toFixed(1)),
      })),
    [coverage.data],
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

  const strikeColumns: Column<StrikeRateRow>[] = [
    { key: 'rep', header: 'Rep', render: (r) => <span className="font-medium">{r.rep_name}</span> },
    { key: 'visits', header: 'Visits', align: 'right', render: (r) => num(r.visits) },
    { key: 'productive', header: 'Productive', align: 'right', render: (r) => num(r.productive) },
    {
      key: 'strike',
      header: 'Strike rate',
      align: 'right',
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-pill bg-surface">
            <span
              className="block h-full rounded-pill bg-yellow"
              style={{ width: `${Math.max(0, Math.min(100, r.strike_rate_pct))}%` }}
            />
          </span>
          <span className="w-12 text-right font-medium">{pct(r.strike_rate_pct, 1)}</span>
        </span>
      ),
    },
  ];

  const s = summary.data;
  const coverageByRepEmpty =
    (coverage.data?.by_rep.length ?? 0) === 0 && (coverage.data?.series.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Coverage, strike-rate, sales and receivables, scoped to your role and territory."
      />

      {/* KPI cards. Growth compares month-to-date against the same window last month. */}
      {summary.isLoading ? (
        <LoadingState />
      ) : summary.isError ? (
        <ErrorState message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
      ) : (
        s && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Coverage"
                value={pct(s.coverage_pct, 1)}
                sub="Outlets visited MTD"
                growth={points(s.coverage_pct, s.coverage_pct_prev)}
                growthUnit="pp"
                growthTitle={priorNote(s.coverage_pct_prev, (v) => pct(v, 1))}
              />
              <KpiCard
                label="Strike rate"
                value={pct(s.strike_rate_pct, 1)}
                sub="Visits that convert to an order"
                growth={points(s.strike_rate_pct, s.strike_rate_pct_prev)}
                growthUnit="pp"
                growthTitle={priorNote(s.strike_rate_pct_prev, (v) => pct(v, 1))}
              />
              <KpiCard
                label="Sales MTD"
                value={moneyCompact(s.sales_mtd)}
                sub="Booked order value"
                growth={relative(s.sales_mtd, s.sales_prev)}
                growthTitle={priorNote(s.sales_prev, moneyCompact)}
                tone="gold"
              />
              <KpiCard
                label="Outstanding"
                value={moneyCompact(s.outstanding_total)}
                sub={overdueSub(s.outstanding_overdue)}
                tone="danger"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Active outlets" value={num(s.active_outlets ?? 0)} />
              <MiniStat
                label="Outlets to review"
                value={s.pending_approvals === undefined ? '-' : num(s.pending_approvals)}
                to={can('approve_outlets') ? '/approvals' : undefined}
                tone={(s.pending_approvals ?? 0) > 0 ? 'warning' : 'default'}
                sub={
                  s.pending_approvals === undefined
                    ? undefined
                    : s.pending_approvals > 0
                      ? 'Awaiting approval'
                      : 'Queue clear'
                }
              />
              <MiniStat
                label="Visits MTD"
                value={s.visits_mtd === undefined ? '-' : num(s.visits_mtd)}
                sub={priorSub(s.visits_mtd, s.visits_prev)}
              />
              <MiniStat
                label="Orders MTD"
                value={s.orders_mtd === undefined ? '-' : num(s.orders_mtd)}
                sub={priorSub(s.orders_mtd, s.orders_prev)}
              />
            </div>
          </>
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
                  emptyHint="Orders booked this month appear here, split by the selected grouping."
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
        {/* Coverage trend: cumulative distinct outlets visited, month-to-date. */}
        <Card>
          <CardHeader
            title="Coverage trend"
            subtitle={
              coverage.data
                ? `Overall ${pct(coverage.data.overall_coverage_pct, 1)}, outlet coverage ${pct(coverage.data.outlet_coverage_pct, 1)}. Cumulative, month to date.`
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
          <CardHeader title="Coverage by rep" subtitle="Distinct outlets visited over outlets assigned" />
          {coverage.isLoading ? (
            <LoadingState />
          ) : coverage.isError ? (
            <ErrorState message={errorMessage(coverage.error)} onRetry={() => coverage.refetch()} />
          ) : (
            <SimpleBar
              data={coverageByRep}
              domain={[0, 100]}
              valueFormatter={(v) => `${v}%`}
              emptyTitle={coverageByRepEmpty ? 'No reps in your scope' : 'No visits yet this month'}
              emptyHint={
                coverageByRepEmpty
                  ? 'Assign reps to a territory to compare their coverage here.'
                  : 'Each rep appears here once they have outlets assigned and start checking in.'
              }
            />
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Strike-rate trend: per-day conversion, not cumulative. */}
        <Card>
          <CardHeader
            title="Strike rate trend"
            subtitle={
              strike.data
                ? `${num(strike.data.productive)} of ${num(strike.data.visits)} visits productive MTD. Daily conversion.`
                : 'Orders per visit over time'
            }
          />
          {strike.isLoading ? (
            <LoadingState />
          ) : strike.isError ? (
            <ErrorState message={errorMessage(strike.error)} onRetry={() => strike.refetch()} />
          ) : (
            <StrikeRateLineChart data={strike.data?.series ?? []} />
          )}
        </Card>

        {/* Strike rate by rep */}
        <Card pad={false}>
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-display text-base leading-tight text-ink">Strike rate by rep</h3>
            <p className="mt-0.5 text-xs text-ink-faint">
              Productive visits over total visits, month to date
            </p>
          </div>
          <DataTable
            columns={strikeColumns}
            rows={strike.data?.by_rep ?? []}
            rowKey={(r) => r.rep_id}
            loading={strike.isLoading}
            error={strike.isError ? errorMessage(strike.error) : null}
            onRetry={() => strike.refetch()}
            emptyTitle="No visits yet this month"
            emptyHint="Reps appear here as soon as they log their first visit."
          />
        </Card>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  to,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  to?: string;
  tone?: 'default' | 'warning';
}) {
  const body = (
    <>
      <div className="text-xs text-ink-faint">{label}</div>
      <div
        className={
          'tnum mt-0.5 text-lg font-semibold ' + (tone === 'warning' ? 'text-warning' : 'text-ink')
        }
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-faint">{sub}</div>}
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="card block cursor-pointer p-3 transition-colors hover:border-ink/20 hover:bg-surface"
      >
        {body}
      </Link>
    );
  }
  return <div className="card p-3">{body}</div>;
}

/** Percentage-point delta for KPIs that are themselves rates (coverage, strike rate). */
function points(current: number, prior?: number): number | null {
  if (prior === undefined || !Number.isFinite(prior)) return null;
  return current - prior;
}

/** Relative growth for absolute KPIs (money, counts). A zero base has no growth rate. */
function relative(current: number, prior?: number): number | null {
  if (prior === undefined || !Number.isFinite(prior) || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function priorNote(prior: number | undefined, fmt: (v: number) => string): string | undefined {
  if (prior === undefined) return undefined;
  return `${fmt(prior)} in the same window last month`;
}

function priorSub(current?: number, prior?: number): string | undefined {
  if (prior === undefined || current === undefined) return undefined;
  const delta = current - prior;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${num(delta)} vs last month`;
}

function overdueSub(overdue?: number): string {
  if (overdue === undefined) return 'Receivables';
  if (overdue <= 0) return 'Nothing overdue';
  return `${moneyCompact(overdue)} overdue`;
}
