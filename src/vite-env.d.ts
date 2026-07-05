/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  // Optional UI feature flag for the Store workspace (STORE_CONTRACT §15.1).
  // Defaults to enabled; set to "false" to hide the Store workspace switcher.
  readonly VITE_STORE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
