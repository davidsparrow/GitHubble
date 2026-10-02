import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { encodeGalaxy } from "../../lib/galaxyPayload";
import type { RepositoryRow } from "../../lib/importer/rows";
import type { Repository } from "../../lib/types";
import type { SupabaseConfig } from "../../server/env";

const UPSERT_CHUNK = 500;
export const SNAPSHOT_FILE = path.join(".cache", "galaxy-snapshot.json");

const MIGRATION_HINT =
  "Create the table first: `npm run db:push` (needs SUPABASE_DB_URL), or paste " +
  "supabase/migrations/20261002000000_create_repositories.sql into the Supabase SQL editor.";

/**
 * Upserts this run's galaxy, then takes repositories that weren't part of it
 * out of the galaxy. New rows are written before old ones are retired, so the
 * app never sees an empty galaxy mid-import.
 */
export async function writeToSupabase(
  rows: readonly RepositoryRow[],
  config: SupabaseConfig,
  runStartedAt: string,
): Promise<{ upserted: number; retired: number }> {
  const supabase = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabase.from("repositories").upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "github_id" });
    if (error) {
      const missingTable = error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message);
      throw new Error(`Supabase upsert failed: ${error.message}${missingTable ? `\n${MIGRATION_HINT}` : ""}`);
    }
  }

  const { error, count } = await supabase
    .from("repositories")
    .update({ in_galaxy: false }, { count: "exact" })
    .eq("in_galaxy", true)
    .lt("indexed_at", runStartedAt);
  if (error) throw new Error(`Supabase cleanup failed: ${error.message}`);

  return { upserted: rows.length, retired: count ?? 0 };
}

/** For --dry-run: the same payload the API serves, saved locally (the dev server falls back to it). */
export async function writeSnapshot(repositories: readonly Repository[], indexedAt: string): Promise<string> {
  await mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
  await writeFile(SNAPSHOT_FILE, JSON.stringify(encodeGalaxy(repositories, indexedAt)));
  return SNAPSHOT_FILE;
}
