import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { pct } from '@/lib/format';

export function KpiCard({
  label,
  value,
  sub,
  growth,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  growth?: number | null;
  tone?: 'default' | 'danger' | 'gold';
}) {
  const up = growth !== undefined && growth !== null && growth >= 0;
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
        {growth !== undefined && growth !== null && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-xs font-semibold tnum',
              up ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger',
            )}
          >
            {up ? (
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {pct(Math.abs(growth), 1)}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}
