// The real map (OUTLET_MAP_CONTRACT §2). Leaflet + react-leaflet + supercluster.
//
// This module is the ONLY place in the app that imports Leaflet, and it is only
// ever reached through `MapPanel`'s React.lazy boundary — so Leaflet, its CSS and
// supercluster live in their own chunk and never touch the entry bundle. Keep it
// that way: do not import this file eagerly from a page.
//
// On marker icons: we never touch `L.Icon.Default`, so the well-known Vite
// bundling bug (default marker PNGs resolved relative to the CSS and 404-ing) is
// structurally impossible here — every marker is a `divIcon` with inline SVG,
// which is what we need anyway for status colours.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import Supercluster from 'supercluster';
import type { ClusterFeature, PointFeature } from 'supercluster';
import type { OutletGeoItem } from '@/api/types';
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_SUBDOMAINS, TILE_URL } from './tiles';
import { GOLD_INK, INK, PAPER, TONE_FILL, outletTone, repTone } from './types';
import type { MapRep, MapTone, OutletMapProps } from './types';

import 'leaflet/dist/leaflet.css';
import './map.css';

// Cluster below this zoom; above it every outlet gets its own pin.
const CLUSTER_MAX_ZOOM = 16;
const CLUSTER_RADIUS_PX = 58;
const FIT_MAX_ZOOM = 16;
const DEFAULT_GEOFENCE_M = 100;

// ---------------------------------------------------------------- icons

const iconCache = new Map<string, L.DivIcon>();

function cached(key: string, make: () => L.DivIcon): L.DivIcon {
  const hit = iconCache.get(key);
  if (hit) return hit;
  const icon = make();
  iconCache.set(key, icon);
  return icon;
}

/** Teardrop pin, status-coloured, paper-stroked. Anchored at its tip. */
function outletIcon(tone: MapTone, selected: boolean): L.DivIcon {
  return cached(`o:${tone}:${selected}`, () => {
    const w = selected ? 30 : 24;
    const h = selected ? 40 : 32;
    const fill = TONE_FILL[tone];
    const html = `
      <svg width="${w}" height="${h}" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 31.2C12 31.2 23 18.6 23 11.4A11 11 0 0 0 1 11.4C1 18.6 12 31.2 12 31.2Z"
              fill="${fill}" stroke="${selected ? INK : PAPER}" stroke-width="${selected ? 2 : 1.75}"/>
        <circle cx="12" cy="11.2" r="4.1" fill="${PAPER}" fill-opacity="${selected ? 1 : 0.92}"/>
      </svg>`;
    return L.divIcon({
      html,
      className: 'ok-pin',
      iconSize: [w, h],
      iconAnchor: [w / 2, h],
      tooltipAnchor: [0, -h + 6],
    });
  });
}

/** Reps read as a person, not a place: a round initials chip, centre-anchored. */
function repIcon(rep: MapRep, selected: boolean): L.DivIcon {
  const tone = repTone(rep.status);
  const label = initials(rep.name);
  return cached(`r:${tone}:${label}:${selected}`, () => {
    const d = selected ? 38 : 32;
    const fill = TONE_FILL[tone];
    const html = `
      <span class="ok-rep${rep.status === 'active' ? ' ok-rep--live' : ''}"
            style="--rep-fill:${fill};width:${d}px;height:${d}px;${
              selected ? `box-shadow:0 0 0 2px ${INK}, 0 6px 16px -6px rgba(31,27,18,.5);` : ''
            }">${label}</span>`;
    return L.divIcon({
      html,
      className: 'ok-pin',
      iconSize: [d, d],
      iconAnchor: [d / 2, d / 2],
      tooltipAnchor: [0, -d / 2],
    });
  });
}

/** Gold bubble sized by magnitude — a 400-outlet cluster should not look like a 3. */
function clusterIcon(count: number): L.DivIcon {
  return cached(`c:${count}`, () => {
    const d = count < 10 ? 34 : count < 50 ? 40 : count < 200 ? 46 : count < 1000 ? 52 : 58;
    const label = count < 1000 ? String(count) : `${Math.floor(count / 1000)}k+`;
    const html = `<span class="ok-cluster" style="width:${d}px;height:${d}px;font-size:${
      d < 40 ? 11 : d < 50 ? 12 : 13
    }px">${label}</span>`;
    return L.divIcon({ html, className: 'ok-pin', iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
  });
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

// ---------------------------------------------------------------- map plumbing

/**
 * Fit the viewport to the data. Runs once per `fitKey` — NOT on every render and
 * not on every poll. Live Ops refetches every 30s; refitting there would rip the
 * map away from a manager who had panned to look at something.
 */
function FitBounds({ points, fitKey }: { points: L.LatLngTuple[]; fitKey: string }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    if (points.length === 0 || fitted.current === fitKey) return;
    const bounds = L.latLngBounds(points);
    if (!bounds.isValid()) return;
    fitted.current = fitKey;
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: FIT_MAX_ZOOM });
  }, [map, points, fitKey]);

  return null;
}

/** Fly to an externally selected point (e.g. a rep picked from the Live Ops list). */
function FocusPoint({ focus }: { focus?: { lng: number; lat: number } | null }) {
  const map = useMap();
  const lat = focus?.lat;
  const lng = focus?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
  }, [map, lat, lng]);

  return null;
}

/**
 * Leaflet measures its container on init. If the map mounts while the card is
 * still settling (tab switch, grid reflow) it caches a stale size and paints grey
 * gutters. One invalidateSize on the next frame is the standard cure.
 */
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [map]);
  return null;
}

interface OutletProps {
  outlet: OutletGeoItem;
}

type ViewState = { bbox: [number, number, number, number]; zoom: number };

function readView(map: L.Map): ViewState {
  const b = map.getBounds();
  // Zoomed far out the world repeats and Leaflet happily reports lng < -180.
  // supercluster expects a sane bbox, so clamp.
  return {
    bbox: [
      Math.max(-180, b.getWest()),
      Math.max(-90, b.getSouth()),
      Math.min(180, b.getEast()),
      Math.min(90, b.getNorth()),
    ],
    zoom: Math.round(map.getZoom()),
  };
}

/**
 * Outlet layer. Clustering is REQUIRED here — 500+ raw pins is unusable, and a
 * 5000-pin map (the server cap) would drop frames on pan. supercluster indexes the
 * whole set once and answers "what is visible at this bbox/zoom" in ~a millisecond,
 * so only the handful of markers actually on screen ever become DOM.
 */
function OutletLayer({
  outlets,
  selectedOutletId,
  onOutletClick,
  onHover,
  hoveredId,
}: {
  outlets: OutletGeoItem[];
  selectedOutletId?: string | null;
  onOutletClick?: (id: string) => void;
  onHover: (id: string | null) => void;
  hoveredId: string | null;
}) {
  const map = useMap();
  const [view, setView] = useState<ViewState>(() => readView(map));

  const sync = useCallback(() => setView(readView(map)), [map]);
  useMapEvents({ moveend: sync, zoomend: sync });

  const index = useMemo(() => {
    const features: PointFeature<OutletProps>[] = outlets.map((o) => ({
      type: 'Feature',
      properties: { outlet: o },
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
    }));
    const sc = new Supercluster<OutletProps>({
      radius: CLUSTER_RADIUS_PX,
      maxZoom: CLUSTER_MAX_ZOOM,
      minPoints: 2,
    });
    sc.load(features);
    return sc;
  }, [outlets]);

  const clusters = useMemo(
    () => index.getClusters(view.bbox, view.zoom),
    [index, view.bbox, view.zoom],
  );

  const expandCluster = useCallback(
    (clusterId: number, lat: number, lng: number) => {
      const target = Math.min(index.getClusterExpansionZoom(clusterId), TILE_MAX_ZOOM);
      // Guard against a no-op zoom on coincident coordinates: always make progress.
      const zoom = target > map.getZoom() ? target : Math.min(map.getZoom() + 2, TILE_MAX_ZOOM);
      map.flyTo([lat, lng], zoom, { duration: 0.6 });
    },
    [index, map],
  );

  return (
    <>
      {clusters.map((f) => {
        const [lng, lat] = f.geometry.coordinates;

        if (isCluster(f)) {
          const count = f.properties.point_count;
          return (
            <Marker
              key={`c-${f.properties.cluster_id}`}
              position={[lat, lng]}
              icon={clusterIcon(count)}
              eventHandlers={{
                click: () => expandCluster(f.properties.cluster_id, lat, lng),
              }}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                <span className="tnum font-semibold">{count.toLocaleString('en-IN')}</span> outlets ·
                click to zoom in
              </Tooltip>
            </Marker>
          );
        }

        const o = f.properties.outlet;
        const selected = o.id === selectedOutletId || o.id === hoveredId;
        return (
          <Marker
            key={`o-${o.id}`}
            position={[lat, lng]}
            icon={outletIcon(outletTone(o.status), selected)}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{
              click: () => onOutletClick?.(o.id),
              mouseover: () => onHover(o.id),
              mouseout: () => onHover(null),
            }}
          >
            <Tooltip direction="top">
              <OutletTip outlet={o} />
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

function isCluster(
  f: ClusterFeature<Record<string, unknown>> | PointFeature<OutletProps>,
): f is ClusterFeature<Record<string, unknown>> {
  return (f.properties as { cluster?: boolean }).cluster === true;
}

function OutletTip({ outlet }: { outlet: OutletGeoItem }) {
  return (
    <span className="block leading-snug">
      <span className="block font-semibold text-ink">{outlet.name}</span>
      <span className="tnum block text-ink-faint">
        {outlet.code} · class {outlet.outlet_class} · {outlet.status.replace(/_/g, ' ')}
      </span>
      {outlet.assigned_rep_name && (
        <span className="block text-ink-faint">{outlet.assigned_rep_name}</span>
      )}
      {outlet.outstanding > 0 && (
        <span className="tnum block font-medium text-danger">
          ₹{Math.round(outlet.outstanding).toLocaleString('en-IN')} outstanding
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- component

export default function OutletMap({
  outlets,
  reps = [],
  height = 520,
  selectedOutletId = null,
  selectedRepId = null,
  onOutletClick,
  onRepClick,
  fitKey = 'default',
  focus = null,
  defaultGeofenceM = DEFAULT_GEOFENCE_M,
  className,
}: OutletMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const points = useMemo<L.LatLngTuple[]>(
    () => [
      ...outlets.map((o) => [o.lat, o.lng] as L.LatLngTuple),
      ...reps.map((r) => [r.lat, r.lng] as L.LatLngTuple),
    ],
    [outlets, reps],
  );

  // The geofence ring — what a manager actually wants when a check-in is flagged.
  const ringed = useMemo(
    () => outlets.find((o) => o.id === (hoveredId ?? selectedOutletId)) ?? null,
    [outlets, hoveredId, selectedOutletId],
  );

  // Never hardcode a centre: derive it from the data. FitBounds overrides this on
  // the next tick anyway; this only decides what the very first paint looks like.
  const initial = points[0];

  return (
    <div
      className={className}
      style={{ height }}
      // Leaflet keyboard-pans on arrow keys; keep it out of the page tab order
      // until focused deliberately.
      role="region"
      aria-label="Outlet map"
    >
      <MapContainer
        center={initial ?? [0, 0]}
        zoom={initial ? 13 : 2}
        maxZoom={TILE_MAX_ZOOM}
        scrollWheelZoom
        preferCanvas={false}
        className="ok-map"
        style={{ height: '100%', width: '100%' }}
      >
        {/* Attribution is a licence condition, not decoration. Do not remove.
            No `detectRetina`: the tile URL carries {r}, which Leaflet already swaps
            for "@2x" on HiDPI screens. Setting both ALSO halves the tile size and
            bumps the zoom offset, which serves over-zoomed tiles and quietly costs
            a zoom level off maxZoom. */}
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          subdomains={TILE_SUBDOMAINS}
          maxZoom={TILE_MAX_ZOOM}
        />

        <InvalidateOnMount />
        <FitBounds points={points} fitKey={fitKey} />
        <FocusPoint focus={focus} />

        {ringed && (
          <Circle
            center={[ringed.lat, ringed.lng]}
            radius={ringed.geofence_radius_m ?? defaultGeofenceM}
            pathOptions={{
              color: GOLD_INK,
              weight: 1.5,
              fillColor: TONE_FILL.gold,
              fillOpacity: 0.14,
              dashArray: '4 3',
            }}
          />
        )}

        <OutletLayer
          outlets={outlets}
          selectedOutletId={selectedOutletId}
          onOutletClick={onOutletClick}
          onHover={setHoveredId}
          hoveredId={hoveredId}
        />

        {/* Reps sit OUTSIDE the cluster index on purpose: there are a handful of
            them and they are the point of Live Ops — they must never disappear
            into an outlet bubble. */}
        {reps.map((r) => (
          <Marker
            key={`r-${r.id}`}
            position={[r.lat, r.lng]}
            icon={repIcon(r, r.id === selectedRepId)}
            zIndexOffset={2000}
            eventHandlers={{ click: () => onRepClick?.(r.id) }}
          >
            <Tooltip direction="top">
              <span className="block leading-snug">
                <span className="block font-semibold text-ink">{r.name}</span>
                {r.detail && <span className="block text-ink-faint">{r.detail}</span>}
              </span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
