// Shared map vocabulary. This module is deliberately LEAFLET-FREE: pages import
// these types + the tone palette, and must be able to do so without dragging
// Leaflet into their own chunk. Anything that touches `leaflet` belongs in
// OutletMap.tsx (the lazily-loaded chunk), never here.
import type { OutletGeoItem, OutletStatus } from '@/api/types';

export type MapTone = 'brand' | 'gold' | 'danger' | 'info' | 'muted';

/**
 * The pin palette, carried over verbatim from the old `MiniMap` so the visual
 * language does not change when the fake map becomes a real one. These are the
 * brand tokens from index.css `:root`, hard-coded because Leaflet paints markers
 * into detached DOM/SVG where Tailwind's `rgb(var(--x))` classes are awkward to
 * thread through.
 */
export const TONE_FILL: Record<MapTone, string> = {
  brand: '#1B5E20', // --success  organic green
  gold: '#F0B61A', // --yellow   the oil
  danger: '#9B2C2C', // --danger   warm brick
  info: '#2C7A7B', // --info     muted teal
  muted: '#7A7262', // --ink-faint
};

export const PAPER = '#FAF9F5'; // --paper, pin stroke
export const INK = '#1C1912'; // --ink
export const GOLD_INK = '#926409'; // --gold-ink, geofence ring

/**
 * Outlet status -> pin tone. Mirrors `OUTLET_TONE` in StatusPill.tsx so a pin and
 * the status chip next to it never disagree: active reads green, anything waiting
 * on a human reads gold, dead/rejected reads brick, dormant reads teal.
 */
const OUTLET_TONE: Record<OutletStatus, MapTone> = {
  prospect: 'muted',
  pending_approval: 'gold',
  active: 'brand',
  dormant: 'info',
  churned: 'danger',
  rejected: 'danger',
};

export function outletTone(status: OutletStatus): MapTone {
  return OUTLET_TONE[status] ?? 'muted';
}

/** A rep's last-known position, plotted alongside the outlets on Live Ops. */
export interface MapRep {
  id: string;
  name: string;
  lng: number;
  lat: number;
  status: 'active' | 'idle' | 'offline';
  /** Free-text line under the name in the tooltip, e.g. "Verma Stores · 4m ago". */
  detail?: string;
}

const REP_TONE: Record<MapRep['status'], MapTone> = {
  active: 'brand',
  idle: 'gold',
  offline: 'muted',
};

export function repTone(status: MapRep['status']): MapTone {
  return REP_TONE[status] ?? 'muted';
}

export interface OutletMapProps {
  outlets: OutletGeoItem[];
  reps?: MapRep[];
  height?: number;
  /** Outlet whose geofence ring is drawn and whose pin is enlarged. */
  selectedOutletId?: string | null;
  /** Rep pin to enlarge (Live Ops list selection). */
  selectedRepId?: string | null;
  onOutletClick?: (id: string) => void;
  onRepClick?: (id: string) => void;
  /**
   * Re-fit the viewport to the data whenever this string changes (e.g. when the
   * filters change). Bounds are otherwise fitted exactly once, on first data —
   * refitting on every poll would yank the map out from under a manager who has
   * panned somewhere on purpose.
   */
  fitKey?: string;
  /** Pan/zoom to this point when it changes. Used to fly to a selected rep. */
  focus?: { lng: number; lat: number } | null;
  /** Fallback ring radius for outlets with no `geofence_radius_m` of their own. */
  defaultGeofenceM?: number;
  className?: string;
}
