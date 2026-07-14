// Basemap configuration (OUTLET_MAP_CONTRACT §2).
//
// Default: CARTO Positron — OpenStreetMap data rendered in a light, muted style.
// It sits under the brand's warm paper/ink palette without fighting the status
// pins for attention, which the default OSM sheet (saturated greens, red roads)
// does. Override with VITE_MAP_TILE_URL to point at any {z}/{x}/{y} raster
// source (a self-hosted OSM render, a paid provider, an offline tile cache).

const CARTO_POSITRON = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

const OSM_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_CREDIT = '&copy; <a href="https://carto.com/attributions">CARTO</a>';

function env(key: 'VITE_MAP_TILE_URL' | 'VITE_MAP_TILE_ATTRIBUTION'): string {
  return (import.meta.env[key] ?? '').trim();
}

export const TILE_URL: string = env('VITE_MAP_TILE_URL') || CARTO_POSITRON;

/** CARTO serves a-d; harmless for providers that ignore {s}. */
export const TILE_SUBDOMAINS = 'abcd';

export const TILE_MAX_ZOOM = 19;

/**
 * Attribution is MANDATORY and non-negotiable — it is the licence condition on
 * ODbL map data, not a design choice. This module makes it structurally hard to
 * lose: a deployment may *add* its own provider credit via
 * VITE_MAP_TILE_ATTRIBUTION, but the OpenStreetMap credit is re-appended if the
 * override omits it. There is no code path that renders tiles with no credit.
 */
export const TILE_ATTRIBUTION: string = (() => {
  const override = env('VITE_MAP_TILE_ATTRIBUTION');
  if (!override) {
    // No override: if the URL is still CARTO's, credit CARTO. If an operator
    // swapped the URL but not the credit, do NOT keep claiming CARTO rendered it.
    return TILE_URL === CARTO_POSITRON ? `${OSM_CREDIT} ${CARTO_CREDIT}` : OSM_CREDIT;
  }
  return /openstreetmap\.org/i.test(override) ? override : `${override} ${OSM_CREDIT}`;
})();
