import { useMemo } from 'react';
import clsx from 'clsx';
import type { GeoPoint } from '@/api/types';

export interface MapMarker {
  id: string;
  point: GeoPoint;
  label?: string;
  tone?: 'brand' | 'gold' | 'danger' | 'info' | 'muted';
  selected?: boolean;
}

const TONE_FILL: Record<NonNullable<MapMarker['tone']>, string> = {
  brand: '#1B5E20',
  gold: '#F0B61A', // outlet pin = oil-gold
  danger: '#9B2C2C', // out-of-fence / danger = brick
  info: '#2C7A7B',
  muted: '#7A7262',
};

/**
 * Dependency-free map: projects lng/lat into a padded box. Good enough for an
 * ops overview (relative positions of outlets / reps). Not a tiled basemap.
 */
export function MiniMap({
  markers,
  height = 360,
  onSelect,
  className,
}: {
  markers: MapMarker[];
  height?: number;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const { points, bounds } = useMemo(() => {
    const pts = markers
      .filter((m) => m.point?.coordinates)
      .map((m) => ({ ...m, lng: m.point.coordinates[0], lat: m.point.coordinates[1] }));
    if (pts.length === 0) {
      return { points: [], bounds: { minLng: 0, maxLng: 1, minLat: 0, maxLat: 1 } };
    }
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    // pad so single-point or tight clusters don't sit on the edge
    const padLng = (maxLng - minLng || 0.01) * 0.15 + 0.002;
    const padLat = (maxLat - minLat || 0.01) * 0.15 + 0.002;
    minLng -= padLng;
    maxLng += padLng;
    minLat -= padLat;
    maxLat += padLat;
    return { points: pts, bounds: { minLng, maxLng, minLat, maxLat } };
  }, [markers]);

  const W = 800;
  const H = (height / 360) * 800 * 0.45;
  const project = (lng: number, lat: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * W;
    const y = H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * H;
    return { x, y };
  };

  return (
    <div className={clsx('overflow-hidden rounded-card border border-line bg-surface', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} role="img" aria-label="Map">
        {/* subtle warm grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#E6E0D3" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {points.map((m) => {
          const { x, y } = project(m.lng, m.lat);
          const fill = TONE_FILL[m.tone ?? 'gold'];
          return (
            <g
              key={m.id}
              transform={`translate(${x},${y})`}
              onClick={onSelect ? () => onSelect(m.id) : undefined}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              {m.selected && <circle r="11" fill="none" stroke="#1C1912" strokeWidth="1.75" />}
              <circle r={m.selected ? 7 : 5.5} fill={fill} stroke="#FAF9F5" strokeWidth="2" />
              {m.label && (
                <text
                  x="9"
                  y="4"
                  fontSize="11"
                  fill="#1C1912"
                  style={{ fontWeight: m.selected ? 600 : 400 }}
                >
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
        {points.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="14" fill="#7A7262">
            No located points
          </text>
        )}
      </svg>
    </div>
  );
}
