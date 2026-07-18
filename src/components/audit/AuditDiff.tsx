import { useState } from 'react';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { changeType, computeDiff, formatAuditValue, humanizeKey } from '@/lib/audit';
import type { DiffKind, DiffRow } from '@/lib/audit';
import type { AuditLog } from '@/api/types';

// Readable before/after view for one audit entry: a field-level diff ("field:
// old → new", plus added/removed keys), unchanged fields collapsed away, and a
// raw-JSON fallback for power users.
export function AuditDiff({ log }: { log: AuditLog }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const { changed, unchanged } = computeDiff(log.before, log.after);
  const type = changeType(log);

  const heading =
    type === 'create'
      ? 'Created'
      : type === 'delete'
        ? 'Deleted'
        : type === 'update'
          ? 'Updated'
          : 'No snapshot';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs text-ink-faint">
        <span className="font-semibold uppercase tracking-[0.06em] text-ink-muted">{heading}</span>
        {changed.length > 0 && (
          <span className="tnum">
            · {changed.length} field{changed.length === 1 ? '' : 's'} changed
          </span>
        )}
      </div>

      {changed.length === 0 && unchanged.length === 0 ? (
        <div className="rounded-chip border border-line bg-surface p-3 text-xs text-ink-faint">
          This entry carries no before/after snapshot — see the request metadata above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-chip border border-line">
          {changed.length === 0 && (
            <div className="border-b border-line px-3 py-2 text-xs text-ink-faint">
              No fields changed.
            </div>
          )}
          {changed.map((row) => (
            <DiffRowView key={row.key} row={row} />
          ))}
          {showUnchanged && unchanged.map((row) => <DiffRowView key={row.key} row={row} muted />)}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {unchanged.length > 0 && (
          <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowUnchanged((v) => !v)}>
            {showUnchanged ? 'Hide' : 'Show'} {unchanged.length} unchanged
          </Button>
        )}
        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide' : 'Show'} raw JSON
        </Button>
      </div>

      {showRaw && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RawBlock label="Before" value={log.before} />
          <RawBlock label="After" value={log.after} />
        </div>
      )}
    </div>
  );
}

function DiffRowView({ row, muted }: { row: DiffRow; muted?: boolean }) {
  const before = formatAuditValue(row.key, row.before);
  const after = formatAuditValue(row.key, row.after);
  return (
    <div
      className={clsx(
        'grid grid-cols-[minmax(110px,0.7fr)_1fr] items-start gap-x-3 gap-y-1 border-b border-line px-3 py-2 last:border-b-0',
        muted && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1.5 pt-px">
        <TagDot kind={row.kind} muted={muted} />
        <span className="break-words text-xs font-medium text-ink">{humanizeKey(row.key)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {muted ? (
          <span className="tnum break-all text-ink-faint">{after}</span>
        ) : row.kind === 'added' ? (
          <span className="tnum break-all font-medium text-success">{after}</span>
        ) : row.kind === 'removed' ? (
          <span className="tnum break-all text-danger line-through">{before}</span>
        ) : (
          <>
            <span className="tnum break-all text-ink-faint line-through">{before}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" strokeWidth={1.5} />
            <span className="tnum break-all font-medium text-ink">{after}</span>
          </>
        )}
      </div>
    </div>
  );
}

function TagDot({ kind, muted }: { kind: DiffKind; muted?: boolean }) {
  const tone = muted
    ? 'bg-ink-faint/40'
    : kind === 'added'
      ? 'bg-success'
      : kind === 'removed'
        ? 'bg-danger'
        : 'bg-info';
  return <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', tone)} aria-hidden />;
}

function RawBlock({ label, value }: { label: string; value: Record<string, unknown> | null | undefined }) {
  return (
    <div>
      <div className="label">{label}</div>
      <pre className="tnum max-h-64 overflow-auto rounded-chip border border-line bg-surface p-2 text-[11px] leading-relaxed">
        {value ? JSON.stringify(value, null, 2) : '—'}
      </pre>
    </div>
  );
}
