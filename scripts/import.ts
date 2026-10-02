/**
 * GitHubble importer: GitHub → classification → galaxy layout → Supabase.
 *
 *   npm run import                       full run (needs GITHUB_TOKEN, ANTHROPIC_API_KEY, Supabase keys)
 *   npm run import -- --dry-run          write .cache/galaxy-snapshot.json instead of Supabase
 *   npm run import -- --heuristic        classify with keyword rules instead of Claude (no API cost)
 *
 * Options: --limit <n> (default 1500), --min-stars <n> (default 1000),
 * --active-months <n> (only repos pushed to in the last n months, default 18),
 * --refresh (ignore cached GitHub responses).
 */
import { parseArgs } from "node:util";
import type { Candidate } from "../lib/importer/candidate";
import type { Classification } from "../lib/importer/classification";
import { toRepository, toRow } from "../lib/importer/rows";
import { buildSearchQuery, monthsAgo, SEARCH_TOPICS } from "../lib/importer/searchQueries";
import { selectDiverse } from "../lib/importer/selection";
import { layoutGalaxy } from "../lib/galaxyLayout";
import { classifierModel, githubToken, supabaseWriteConfig } from "../server/env";
import { classifyCandidates, verifyModel, type ClassificationStats } from "./importer/classifier";
import { GitHubClient } from "./importer/github";
import { loadEnv } from "./importer/loadEnv";
import { writeSnapshot, writeToSupabase } from "./importer/writer";

const log = (message: string) => console.log(message);

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  loadEnv();
  const { values } = parseArgs({
    options: {
      limit: { type: "string", default: "1500" },
      "min-stars": { type: "string", default: "1000" },
      "active-months": { type: "string", default: "18" },
      "dry-run": { type: "boolean", default: false },
      heuristic: { type: "boolean", default: false },
      refresh: { type: "boolean", default: false },
    },
  });
  const limit = Number(values.limit);
  const minStars = Number(values["min-stars"]);
  const activeSince = monthsAgo(Number(values["active-months"]));
  const dryRun = values["dry-run"];
  const model = classifierModel();
  const runStartedAt = new Date().toISOString();

  const token = githubToken();
  if (!token) fail("GITHUB_TOKEN is not set (add it to .env.local).");
  if (!values.heuristic && !process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set (or run with --heuristic).");
  const supabase = supabaseWriteConfig();
  if (!dryRun && !supabase) fail("Supabase URL and service-role key are not set (or run with --dry-run).");
  if (!values.heuristic) await verifyModel(model, log);

  // 1. Search: the most-starred active repositories for each topic.
  log(`\nSearching GitHub: ${SEARCH_TOPICS.length} topics, ≥${minStars} stars, pushed since ${activeSince}`);
  const github = new GitHubClient(token, { useCache: !values.refresh, log });
  const lists: Candidate[][] = [];
  for (const [i, topic] of SEARCH_TOPICS.entries()) {
    const results = await github.searchRepositories(buildSearchQuery(topic, { minStars, activeSince }));
    lists.push(results);
    if ((i + 1) % 10 === 0 || i === SEARCH_TOPICS.length - 1) log(`  ${i + 1}/${SEARCH_TOPICS.length} topics searched`);
  }
  const unique = new Set(lists.flat().map((c) => c.githubId)).size;
  log(`  ${unique} unique candidates`);

  // 2–3. Classify a diverse pool, then fill the galaxy with the software among it.
  //      Non-software (lists, books, courses) frees slots, so the pool grows until full.
  const classifications = new Map<number, Classification>();
  const totals: ClassificationStats = { cached: 0, byModel: 0, byHeuristic: 0, inputTokens: 0, outputTokens: 0, cost: null };
  let poolSize = Math.ceil(limit * 1.2);
  let galaxy: Candidate[] = [];
  for (let round = 1; round <= 4; round++) {
    const pool = selectDiverse(lists, poolSize).filter((c) => !classifications.has(c.githubId));
    if (pool.length > 0) {
      log(`\nClassifying ${pool.length} repositories${values.heuristic ? " with keyword rules" : ` with ${model}`}`);
      const { classifications: batch, stats } = await classifyCandidates(
        pool,
        values.heuristic ? { kind: "heuristic" } : { kind: "claude", model },
        log,
      );
      for (const [id, classification] of batch) classifications.set(id, classification);
      totals.cached += stats.cached;
      totals.byModel += stats.byModel;
      totals.byHeuristic += stats.byHeuristic;
      totals.inputTokens += stats.inputTokens;
      totals.outputTokens += stats.outputTokens;
      totals.cost = stats.cost === null ? totals.cost : (totals.cost ?? 0) + stats.cost;
    }
    galaxy = selectDiverse(lists, limit, (c) => classifications.get(c.githubId)?.isSoftware === true);
    if (galaxy.length >= limit || pool.length === 0) break;
    poolSize += Math.ceil((limit - galaxy.length) * 1.5);
  }
  const excluded = [...classifications.values()].filter((c) => !c.isSoftware).length;

  // 4. Lay out the galaxy (deterministic per repository id).
  const repositories = galaxy.map((c) => toRepository(c, classifications.get(c.githubId)!));
  const positions = layoutGalaxy(repositories);
  repositories.forEach((repo, i) => Object.assign(repo, positions[i]));

  // 5. Write.
  log("");
  if (dryRun) {
    const file = await writeSnapshot(repositories, runStartedAt);
    log(`Dry run: wrote ${repositories.length} repositories to ${file} (the dev server serves it when Supabase isn't configured)`);
  } else {
    const rows = galaxy.map((c, i) => toRow(c, classifications.get(c.githubId)!, positions[i], runStartedAt));
    const { upserted, retired } = await writeToSupabase(rows, supabase!, runStartedAt);
    log(`Supabase: ${upserted} repositories in the galaxy, ${retired} retired from the previous import`);
  }

  // 6. Summary.
  const byCluster = new Map<string, number>();
  for (const repo of repositories) byCluster.set(repo.clusterId, (byCluster.get(repo.clusterId) ?? 0) + 1);
  log(`\nGalaxy: ${repositories.length} repositories (${excluded} non-software skipped)`);
  log(`  ${[...byCluster].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(" · ")}`);
  log(
    `Classification: ${totals.byModel} by model, ${totals.cached} cached, ${totals.byHeuristic} by keyword rules` +
      (totals.inputTokens > 0
        ? ` · ${totals.inputTokens.toLocaleString()} in / ${totals.outputTokens.toLocaleString()} out tokens` +
          (totals.cost !== null ? ` (≈ $${totals.cost.toFixed(2)})` : "")
        : ""),
  );
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
