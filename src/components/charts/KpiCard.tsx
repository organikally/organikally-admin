import clsx from 'clsx';
import { growthArrow, growthColor, pct } from '@/lib/format';

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
  return (
    <div
      className={clsx(
        'card p-4',
        tone === 'gold' && 'border-accent/40 bg-gradient-to-br from-surface to-[#FBF4DE]',
        tone === 'danger' && 'border-danger/30',
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="nums text-2xl font-semibold text-ink">{value}</span>
        {growth !== undefined && growth !== null && (
          <span className={clsx('text-xs font-medium', growthColor(growth))}>
            {growthArrow(growth)} {pct(Math.abs(growth), 1)}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
