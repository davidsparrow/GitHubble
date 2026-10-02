/**
 * Applies supabase/migrations to the database in SUPABASE_DB_URL using the
 * Supabase CLI (the global `supabase` if installed, otherwise via npx).
 *
 * Alternative without a connection string: paste the migration SQL into the
 * Supabase dashboard's SQL editor and run it once.
 */
import { spawnSync } from "node:child_process";
import { supabaseDbUrl } from "../server/env";
import { loadEnv } from "./importer/loadEnv";

loadEnv();
const dbUrl = supabaseDbUrl();
if (!dbUrl) {
  console.error(
    "✗ SUPABASE_DB_URL is not set.\n" +
      "  Add the connection string from Supabase → Connect (session pooler) to .env.local,\n" +
      "  or run supabase/migrations/*.sql in the Supabase SQL editor instead.",
  );
  process.exit(1);
}

const hasGlobalCli = spawnSync("supabase", ["--version"], { stdio: "ignore" }).status === 0;
const [command, ...args] = hasGlobalCli
  ? ["supabase", "db", "push", "--db-url", dbUrl]
  : ["npx", "--yes", "supabase@2", "db", "push", "--db-url", dbUrl];
const result = spawnSync(command, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
