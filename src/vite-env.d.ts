/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  // Optional UI feature flag for the Store workspace (STORE_CONTRACT §15.1).
  // Defaults to enabled; set to "false" to hide the Store workspace switcher.
  readonly VITE_STORE_ENABLED?: string;
  // Basemap raster tile URL (OUTLET_MAP_CONTRACT §2). Defaults to CARTO Positron.
  readonly VITE_MAP_TILE_URL?: string;
  // Tile-provider credit. The OpenStreetMap credit is enforced regardless.
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
