import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Store } from 'lucide-react';
import { analytics, outlets } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { Pill } from '@/components/ui/StatusPill';
import { MapPanel } from '@/components/map/MapPanel';
import type { MapRep } from '@/components/map/types';
import { fromNow, pct } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { LiveOpsRep } from '@/api/types';

const REFRESH_MS = 30_000;

export function LiveOpsPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['analytics', 'live-ops'],
    queryFn: analytics.liveOps,
    refetchInterval: REFRESH_MS,
  });

  // The outlets a rep is meant to be working. Without them the rep pins float in a
  // void — "is he anywhere near a shop?" is the whole question Live Ops answers.
  // Territory-scoped by the server; cached, and NOT on the 30s poll (shops do not
  // move, reps do).
  const geo = useQuery({
    queryKey: ['outlets', 'geo', { scope: 'live-ops' }],
    queryFn: () => outlets.geo(),
    staleTime: 5 * 60_000,
  });

  const reps = useMemo(() => q.data?.reps ?? [], [q.data]);

  const repPins: MapRep[] = useMemo(
    () =>
      reps
        .filter((r) => r.last_location?.coordinates)
        .map((r) => ({
          id: r.rep_id,
          name: r.rep_name,
          // GeoPoint is [lng, lat] — order matters, do not swap.
          lng: r.last_location!.coordinates[0],
          lat: r.last_location!.coordinates[1],
          status: r.status,
          detail: `${lastShop(r)} · last seen ${fromNow(r.last_seen_at)}`,
        })),
    [reps],
  );

  // Selecting a rep in the list flies the map to them.
  const focus = useMemo(() => {
    const r = repPins.find((p) => p.id === selected);
    return r ? { lng: r.lng, lat: r.lat } : null;
  }, [repPins, selected]);

  const offMap = reps.length - repPins.length;

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
              subtitle={
                offMap > 0
                  ? `${repPins.length} of ${reps.length} reps have a recent GPS read — ${offMap} not reporting`
                  : 'Reps with a recent GPS read, against the outlets in scope'
              }
            />
            {/* If the outlet feed dies, the reps still plot — but the map would then
                show them against an empty landscape, which reads as "no shops near
                him". Say so instead of letting the absence speak. */}
            {geo.isError && (
              <div className="mb-2 flex items-center gap-2 rounded-chip border border-danger/25 bg-danger/10 px-3 py-2 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-danger" strokeWidth={1.5} />
                <span className="text-ink-muted">
                  Outlets could not be loaded, so only reps are plotted — this map is not showing the
                  shops around them.
                </span>
                <button
                  onClick={() => geo.refetch()}
                  className="ml-auto shrink-0 cursor-pointer font-semibold text-gold-ink hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
            <MapPanel
              outlets={geo.data?.items ?? []}
              reps={repPins}
              height={520}
              // The map is useful the moment reps are on it; a slow outlet feed
              // must not gate it, and an outlet-feed failure must not blank it.
              loading={geo.isLoading && repPins.length === 0}
              total={geo.data?.total}
              truncated={geo.data?.truncated}
              withoutCoords={geo.data?.without_coords ?? 0}
              selectedRepId={selected}
              onRepClick={(id) => setSelected(id === selected ? null : id)}
              onOutletClick={(id) => navigate(`/outlets/${id}`)}
              focus={focus}
              // Fit to reps as soon as they land, then re-fit once when the outlet
              // feed arrives (so the shops are actually in frame). Not on the 30s poll.
              fitKey={`live-ops:${geo.data?.returned ?? 0}`}
              emptyTitle="Nobody is on the map yet"
              emptyHint="Rep positions appear here once they check in from the field, alongside the outlets in your scope."
            />
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

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
