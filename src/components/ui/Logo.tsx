import clsx from 'clsx';

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#1B5E20" />
      <path d="M16 6c-4 4-6 7-6 11a6 6 0 0 0 12 0c0-4-2-7-6-11z" fill="#C9A227" />
      <path d="M16 9v14" stroke="#FAFAF7" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({
  className,
  showSub = true,
}: {
  className?: string;
  showSub?: boolean;
}) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <Mark />
      <div className="leading-tight">
        <div className="font-serif text-lg font-semibold text-forest">Organikally</div>
        {showSub && (
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted">
            Admin Portal
          </div>
        )}
      </div>
    </div>
  );
}
