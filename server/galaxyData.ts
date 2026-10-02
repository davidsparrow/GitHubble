import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { encodeGalaxy, type GalaxyPayload } from "@/lib/galaxyPayload";
import { fromGalaxyRow, GALAXY_COLUMNS, type GalaxyRow } from "@/lib/importer/rows";
import { supabaseReadConfig, type SupabaseConfig } from "./env";

/** PostgREST returns at most this many rows per request by default. */
const PAGE_SIZE = 1000;

/** Written by `npm run import -- --dry-run`; served in development when Supabase isn't configured. */
export const SNAPSHOT_FILE = path.join(".cache", "galaxy-snapshot.json");

/** The live galaxy, or null when no data source is configured. */
export async function loadGalaxyPayload(): Promise<GalaxyPayload | null> {
  const config = supabaseReadConfig();
  if (config) return loadFromSupabase(config);
  if (process.env.NODE_ENV !== "production") return loadSnapshot();
  return null;
}

async function loadFromSupabase({ url, key }: SupabaseConfig): Promise<GalaxyPayload> {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows: GalaxyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("repositories")
      .select(GALAXY_COLUMNS)
      .eq("in_galaxy", true)
      .order("stars", { ascending: false })
      .order("github_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    rows.push(...(data as unknown as GalaxyRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  const indexedAt = rows.reduce((latest, row) => (row.indexed_at > latest ? row.indexed_at : latest), "");
  return encodeGalaxy(rows.map(fromGalaxyRow), indexedAt);
}

async function loadSnapshot(): Promise<GalaxyPayload | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), SNAPSHOT_FILE), "utf8")) as GalaxyPayload;
  } catch {
    return null;
  }
}
