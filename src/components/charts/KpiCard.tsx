import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { pct } from '@/lib/format';

/**
 * `growth` is the change against the same window in the previous month.
 * - unit "pct" (default): a relative change, e.g. sales up 12.4%.
 * - unit "pp":            a percentage-point delta, used for KPIs that are
 *   themselves rates (coverage, strike rate). "Coverage 48% vs 41% last month"
 *   is +7.0 pp, not +17.1%, and reads unambiguously next to a % value.
 * Pass `null`/`undefined` when there is no comparable prior figure: the chip is
 * then hidden rather than showing a fabricated 0%.
 */
export function KpiCard({
  label,
  value,
  sub,
  growth,
  growthUnit = 'pct',
  growthTitle,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  growth?: number | null;
  growthUnit?: 'pct' | 'pp';
  growthTitle?: string;
  tone?: 'default' | 'danger' | 'gold';
}) {
  const hasGrowth = growth !== undefined && growth !== null && Number.isFinite(growth);
  const rounded = hasGrowth ? Number(growth.toFixed(1)) : 0;
  const dir = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';

  return (
    <div
      className={clsx(
        'card p-4',
        tone === 'gold' && 'border-yellow/40',
        tone === 'danger' && 'border-danger/30',
      )}
    >
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="tnum text-2xl font-semibold text-ink">{value}</span>
        {hasGrowth && (
          <span
            title={growthTitle}
            className={clsx(
              'tnum inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-xs font-semibold',
              dir === 'up' && 'bg-success/12 text-success',
              dir === 'down' && 'bg-danger/12 text-danger',
              dir === 'flat' && 'bg-surface text-ink-faint',
            )}
          >
            {dir === 'up' && <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />}
            {dir === 'down' && <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} />}
            {dir === 'flat' && <Minus className="h-3.5 w-3.5" strokeWidth={2} />}
            {growthUnit === 'pp'
              ? `${Math.abs(rounded).toFixed(1)} pp`
              : pct(Math.abs(rounded), 1)}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}
