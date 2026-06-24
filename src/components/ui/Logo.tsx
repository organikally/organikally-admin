import clsx from 'clsx';

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#1C1912" />
      <path d="M16 6c-4 4-6 7-6 11a6 6 0 0 0 12 0c0-4-2-7-6-11z" fill="#F0B61A" />
      <path d="M16 9v14" stroke="#FAF9F5" strokeWidth="1.4" strokeLinecap="round" />
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
        <div className="font-display text-lg leading-none text-ink">Organikally</div>
        {showSub && (
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-ink">
            Admin Portal
          </div>
        )}
      </div>
    </div>
  );
}
