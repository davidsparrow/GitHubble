/**
 * Configuration from environment variables. Accepts the names Supabase, the
 * Vercel ↔ Supabase integration and this project's .env.example use, so
 * existing setups work without renaming anything.
 *
 * Shared by the API route and the importer scripts, so it must not import
 * `server-only` (that guard throws outside Next.js).
 */

function first(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export type SupabaseConfig = { url: string; key: string };

function supabaseUrl(): string | undefined {
  return first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
}

/** Read-only access for the app (anon / publishable key; row-level security applies). */
export function supabaseReadConfig(): SupabaseConfig | null {
  const url = supabaseUrl();
  const key = first(
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  return url && key ? { url, key } : null;
}

/** Write access for the importer (service-role / secret key). Never used by the app. */
export function supabaseWriteConfig(): SupabaseConfig | null {
  const url = supabaseUrl();
  const key = first("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  return url && key ? { url, key } : null;
}

/** Postgres connection string, for applying migrations from the command line. */
export function supabaseDbUrl(): string | undefined {
  return first("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL_NON_POOLING");
}

export function githubToken(): string | undefined {
  return first("GITHUB_TOKEN", "GH_TOKEN");
}

/** Claude model used to classify repositories. Override with CLASSIFIER_MODEL. */
export const DEFAULT_CLASSIFIER_MODEL = "claude-sonnet-5";

export function classifierModel(): string {
  return first("CLASSIFIER_MODEL") ?? DEFAULT_CLASSIFIER_MODEL;
}
