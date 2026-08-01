/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_DEMO_MODE: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ENABLE_MAGIC_LINK?: string;
  readonly VITE_ENABLE_SUPABASE_AUTH?: string;
  /** Clinical agenda repository: `mock` | `supabase`. Inherits from VITE_ENABLE_SUPABASE_AUTH when unset. */
  readonly VITE_CLINICAL_AGENDA_REPOSITORY_MODE?: string;
  /** Clinical portfolio (carteira) repository: `mock` | `supabase`. Inherits from VITE_ENABLE_SUPABASE_AUTH when unset. */
  readonly VITE_CLINICAL_PORTFOLIO_REPOSITORY_MODE?: string;
  /**
   * Clinical record (ficha C02) repository: `mock` | `supabase`.
   * Not related to demo page `/clinica/registros`. Inherits from VITE_ENABLE_SUPABASE_AUTH when unset.
   */
  readonly VITE_CLINICAL_RECORD_REPOSITORY_MODE?: string;
  /** Care plan repository: `mock` | `supabase`. Inherits from VITE_ENABLE_SUPABASE_AUTH when unset. */
  readonly VITE_CLINICAL_CARE_PLAN_REPOSITORY_MODE?: string;
  /** Collective management repository: `mock` | `supabase`. Inherits from VITE_ENABLE_SUPABASE_AUTH when unset. */
  readonly VITE_COLLECTIVE_REPOSITORY_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
