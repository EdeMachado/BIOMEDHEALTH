/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_DEMO_MODE: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ENABLE_MAGIC_LINK?: string;
  readonly VITE_ENABLE_SUPABASE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
