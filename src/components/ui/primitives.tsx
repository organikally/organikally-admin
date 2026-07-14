import clsx from 'clsx';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RotateCw } from 'lucide-react';

// ---------- Card / Panel ----------
export function Card({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return <div className={clsx('card', pad && 'p-4', className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h3 className="font-display text-base leading-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  gold: 'btn-primary', // legacy alias -> oil-gold primary
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={clsx(VARIANT[variant], className)} {...rest}>
      {children}
    </button>
  );
}

// ---------- Spinner ----------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-[18px] w-[18px] animate-spin', className)} strokeWidth={1.5} />;
}

// ---------- Skeleton ----------
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={clsx(
        'relative overflow-hidden rounded-chip bg-surface',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-paper/60 after:to-transparent',
        className,
      )}
    />
  );
}

// ---------- State views ----------
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-faint">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: cols }).map((_, ccol) => (
            <Skeleton
              key={ccol}
              className={clsx('h-4', ccol === 0 ? 'w-1/3' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-danger/12 text-danger">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <div className="font-display text-base text-ink">Something went wrong</div>
      <div className="max-w-md text-xs text-ink-faint">{message}</div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RotateCw className="h-4 w-4" strokeWidth={1.5} />
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink-faint">
        {icon ?? <Inbox className="h-5 w-5" strokeWidth={1.5} />}
      </span>
      <div className="font-display text-base text-ink">{title}</div>
      {hint && <div className="max-w-md text-xs text-ink-faint">{hint}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ---------- Field ----------
export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

// ---------- Eyebrow ----------
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('eyebrow inline-flex items-center gap-2', className)}>
      <span aria-hidden className="h-px w-[1.6rem] bg-gold-ink/50" />
      {children}
    </span>
  );
}

// ---------- Section title ----------
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-lg leading-tight text-ink">{children}</h2>;
}
