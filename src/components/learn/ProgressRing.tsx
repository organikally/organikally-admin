import clsx from 'clsx';
import { Check } from 'lucide-react';

/**
 * Watch-progress ring. Gold arc on a hairline track — completed collapses to a
 * filled check so a finished track reads at a glance.
 */
export function ProgressRing({
  pct,
  complete,
  size = 22,
  stroke = 2.5,
  className,
  label,
}: {
  pct: number;
  complete?: boolean;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const title = label ?? (complete ? 'Watched' : `${Math.round(clamped)}% watched`);

  if (complete) {
    return (
      <span
        title={title}
        aria-label={title}
        className={clsx(
          'grid shrink-0 place-items-center rounded-full bg-success/12 text-success',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Check style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span
      title={title}
      aria-label={title}
      className={clsx('block shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className="stroke-gold-ink transition-[stroke-dashoffset] duration-300 ease-brand"
        />
      </svg>
    </span>
  );
}

/** Flat bar variant — used across the bottom of a card poster. */
export function ProgressBar({
  pct,
  complete,
  className,
}: {
  pct: number;
  complete?: boolean;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, complete ? 100 : pct));
  if (clamped <= 0) return null;
  return (
    <div className={clsx('h-1 w-full bg-ink/15', className)}>
      <div
        className={clsx('h-full transition-[width] duration-300 ease-brand', complete ? 'bg-success' : 'bg-yellow')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
