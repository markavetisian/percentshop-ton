/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RECIPIENT_ADDRESS?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_NETWORK?: string;
  readonly VITE_TICKER?: string;
  readonly VITE_TONCONNECT_MANIFEST_URL?: string;
  readonly VITE_TONCENTER_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
