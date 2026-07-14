// MapPanel — the lazy boundary and the honest-state wrapper around OutletMap.
//
// Pages import THIS, never OutletMap. `React.lazy` here is what keeps Leaflet,
// leaflet.css and supercluster in their own chunk: the import is a dynamic one, so
// Rollup splits it out and the browser only pays for it when a map is actually put
// on screen (on Outlets that means when the user switches to the map view — a
// manager who never leaves the list view never downloads Leaflet at all).
//
// It also owns the states the contract calls out as non-negotiable, because these
// are exactly the states a map is tempted to lie about:
//   - truncated       -> the server capped the feed; say so, with the real total
//   - without_coords  -> outlets that exist but cannot be plotted; say so
//   - zero outlets    -> an empty state, not a grey void
import { Suspense, lazy } from 'react';
import { AlertTriangle, Info, MapPin } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives';
import { TONE_FILL } from './types';
import type { MapTone, OutletMapProps } from './types';

const OutletMap = lazy(() => import('./OutletMap'));

export interface MapPanelProps extends OutletMapProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Total matched in scope. May exceed the number of plotted pins. */
  total?: number;
  /** Server hit its cap — the map is NOT showing everything. */
  truncated?: boolean;
  /** Outlets that exist in scope but have no coordinates, so cannot be plotted. */
  withoutCoords?: number;
  emptyTitle?: string;
  emptyHint?: string;
  /** Hide the status legend (e.g. on a single-outlet detail map). */
  legend?: boolean;
}

export function MapPanel({
  loading,
  error,
  onRetry,
  total,
  truncated,
  withoutCoords = 0,
  emptyTitle = 'Nothing to map yet',
  emptyHint = 'Outlets appear here as soon as reps onboard them with a location.',
  legend = true,
  ...mapProps
}: MapPanelProps) {
  const { outlets, reps = [], height = 520 } = mapProps;
  const plotted = outlets.length;
  const hasPoints = plotted + reps.length > 0;

  if (loading) return <Skeleton style={{ height }} className="w-full rounded-card" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  // Zero plottable points. Note this is NOT necessarily "no outlets": if every
  // outlet in scope lacks coordinates, the honest reading is "we have N, none of
  // them are locatable" — so say that instead of the generic empty line.
  if (!hasPoints) {
    return (
      <div className="rounded-card border border-line bg-surface" style={{ minHeight: height }}>
        <EmptyState
          icon={<MapPin className="h-5 w-5" strokeWidth={1.5} />}
          title={withoutCoords > 0 ? 'No outlet has a location yet' : emptyTitle}
          hint={
            withoutCoords > 0
              ? `${withoutCoords.toLocaleString('en-IN')} ${
                  withoutCoords === 1 ? 'outlet exists' : 'outlets exist'
                } in your scope, but ${
                  withoutCoords === 1 ? 'it has' : 'none have'
                } coordinates recorded — so ${
                  withoutCoords === 1 ? 'it cannot' : 'they cannot'
                } be plotted. They are still in the list view.`
              : emptyHint
          }
        />
      </div>
    );
  }

  return (
    <div>
      {(truncated || withoutCoords > 0) && (
        <div className="mb-2 space-y-1.5">
          {truncated && (
            <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" strokeWidth={1.5} />}>
              Showing the first <Num n={plotted} /> of <Num n={total ?? plotted} /> outlets. Narrow
              the search or filters to see the rest — this map is not complete.
            </Banner>
          )}
          {withoutCoords > 0 && (
            <Banner tone="info" icon={<Info className="h-4 w-4" strokeWidth={1.5} />}>
              <Num n={withoutCoords} /> {withoutCoords === 1 ? 'outlet has' : 'outlets have'} no
              location yet and {withoutCoords === 1 ? 'is' : 'are'} not on this map.{' '}
              {withoutCoords === 1 ? 'It is' : 'They are'} still in the list view.
            </Banner>
          )}
        </div>
      )}

      <Suspense fallback={<Skeleton style={{ height }} className="w-full rounded-card" />}>
        <OutletMap {...mapProps} />
      </Suspense>

      {legend && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-faint">
          <LegendDot tone="brand" label="Active" />
          <LegendDot tone="gold" label="Pending approval" />
          <LegendDot tone="info" label="Dormant" />
          <LegendDot tone="danger" label="Churned / rejected" />
          <LegendDot tone="muted" label="Prospect" />
          <span className="ml-auto">Click a pin to open the outlet · hover for its geofence</span>
        </div>
      )}
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'warning' | 'info';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'warning'
      ? 'border-warning/25 bg-warning/10 text-warning'
      : 'border-info/25 bg-info/10 text-info';
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-chip border px-3 py-2 text-xs font-medium ${cls}`}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span className="text-ink-muted">{children}</span>
    </div>
  );
}

function Num({ n }: { n: number }) {
  return <span className="tnum font-semibold text-ink">{n.toLocaleString('en-IN')}</span>;
}

function LegendDot({ tone, label }: { tone: MapTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
        style={{ background: TONE_FILL[tone] }}
      />
      {label}
    </span>
  );
}
