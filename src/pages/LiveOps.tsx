import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { analytics } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { Pill } from '@/components/ui/StatusPill';
import { MiniMap } from '@/components/ui/MiniMap';
import type { MapMarker } from '@/components/ui/MiniMap';
import { fromNow, pct } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { LiveOpsRep } from '@/api/types';

const REFRESH_MS = 30_000;

export function LiveOpsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['analytics', 'live-ops'],
    queryFn: analytics.liveOps,
    refetchInterval: REFRESH_MS,
  });

  const reps = useMemo(() => q.data?.reps ?? [], [q.data]);

  const markers: MapMarker[] = useMemo(
    () =>
      reps
        .filter((r) => r.last_location)
        .map((r) => ({
          id: r.rep_id,
          point: r.last_location!,
          label: r.rep_name,
          tone: mapTone(r.status),
          selected: r.rep_id === selected,
        })),
    [reps, selected],
  );

  return (
    <div>
      <PageHeader
        title="Live Ops"
        description="Reps' visits today, route progress and last-known location."
        actions={
          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Auto-refresh 30s
            <span className="ml-2">Updated {q.data ? fromNow(q.data.server_time) : '-'}</span>
          </div>
        }
      />

      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-2" pad={false}>
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-display text-base leading-tight text-ink">
                Field reps <span className="tnum text-ink-faint">({reps.length})</span>
              </h3>
            </div>
            <div className="divide-y divide-line">
              {reps.map((r) => (
                <button
                  key={r.rep_id}
                  onClick={() => setSelected(r.rep_id === selected ? null : r.rep_id)}
                  className={
                    'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ' +
                    (r.rep_id === selected ? 'bg-surface' : '')
                  }
                >
                  <span
                    className={
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-paper ' +
                      (r.status === 'active'
                        ? 'bg-success'
                        : r.status === 'idle'
                          ? 'bg-warning'
                          : 'bg-ink-faint')
                    }
                  >
                    {initials(r.rep_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.rep_name}</span>
                      <Pill tone={statusTone(r.status)}>{r.status}</Pill>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                      <span className="tnum shrink-0">
                        {r.visits_today}/{r.planned_today} visits
                      </span>
                      <span className="shrink-0">·</span>
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Store className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        <span className="truncate" title={lastShop(r)}>
                          {lastShop(r)}
                        </span>
                      </span>
                    </div>
                    <ProgressBar value={r.route_progress_pct} />
                    <div className="mt-1 text-[11px] text-ink-faint">
                      Last seen {fromNow(r.last_seen_at)}
                    </div>
                  </div>
                </button>
              ))}
              {reps.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-ink-faint">No active reps.</div>
              )}
            </div>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader
              title="Last-known locations"
              subtitle="Relative positions of reps with a recent GPS read"
            />
            <MiniMap markers={markers} height={460} onSelect={(id) => setSelected(id)} />
          </Card>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface">
        <div className="h-full rounded-pill bg-yellow" style={{ width: `${v}%` }} />
      </div>
      <span className="tnum w-9 text-right text-[11px] text-ink-faint">{pct(v, 0)}</span>
    </div>
  );
}

/**
 * The last shop the rep checked into today. A rep with visits but no resolvable
 * outlet name (stale record) is reported as such rather than as "no check-in",
 * which would contradict the visit count sitting right next to it.
 */
function lastShop(r: LiveOpsRep): string {
  const name = r.last_outlet_name?.trim();
  if (name) return name;
  return r.visits_today > 0 ? 'Visit logged' : 'No check-in yet';
}

function statusTone(s: LiveOpsRep['status']): 'success' | 'warning' | 'neutral' {
  return s === 'active' ? 'success' : s === 'idle' ? 'warning' : 'neutral';
}

function mapTone(s: LiveOpsRep['status']): MapMarker['tone'] {
  return s === 'active' ? 'brand' : s === 'idle' ? 'gold' : 'muted';
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
