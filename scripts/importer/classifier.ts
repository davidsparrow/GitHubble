import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Candidate } from "../../lib/importer/candidate";
import {
  CLASSIFIER_SYSTEM_PROMPT,
  classificationFingerprint,
  classificationRequest,
  mergeResults,
  type Classification,
} from "../../lib/importer/classification";
import { classifyHeuristically } from "../../lib/importer/heuristicClassifier";
import { CLUSTER_IDS, PLATFORMS, PROBLEM_CATEGORIES } from "../../lib/taxonomy";

const CACHE_FILE = path.join(".cache", "classifications.json");
const BATCH_SIZE = 25;
const CONCURRENCY = 4;

/** Input/output $ per million tokens, for the cost summary (Anthropic first-party pricing). */
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
  "claude-opus-5": [5, 25],
};

const BatchResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.number().int(),
      problem: z.enum(PROBLEM_CATEGORIES),
      platform: z.enum(PLATFORMS),
      neighborhood: z.enum(CLUSTER_IDS),
      software: z.boolean(),
    }),
  ),
});

type CacheEntry = { fingerprint: string; classification: Classification };
type Cache = Record<string, CacheEntry>;

export type ClassificationStats = {
  cached: number;
  byModel: number;
  byHeuristic: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD, when the model's price is known. */
  cost: number | null;
};

type Mode = { kind: "claude"; model: string } | { kind: "heuristic" };

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex");

async function readCache(): Promise<Cache> {
  try {
    return JSON.parse(await readFile(CACHE_FILE, "utf8")) as Cache;
  } catch {
    return {};
  }
}

async function writeCache(cache: Cache) {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  const temporary = `${CACHE_FILE}.tmp`;
  await writeFile(temporary, JSON.stringify(cache));
  await rename(temporary, CACHE_FILE);
}

async function mapWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  });
  await Promise.all(workers);
}

/** Fails fast (before any spend) if the model id isn't available to this API key. */
export async function verifyModel(model: string, log: (message: string) => void): Promise<void> {
  const client = new Anthropic();
  try {
    const info = await client.models.retrieve(model);
    log(`Classifier: ${info.display_name} (${info.id})`);
  } catch (error) {
    if (error instanceof Anthropic.NotFoundError) {
      const sonnets: string[] = [];
      for await (const m of client.models.list()) if (m.id.includes("sonnet")) sonnets.push(m.id);
      throw new Error(
        `Model "${model}" isn't available to this API key. Sonnet models it can use: ${sonnets.join(", ") || "none"}. Set CLASSIFIER_MODEL to one of them.`,
      );
    }
    if (error instanceof Anthropic.AuthenticationError) throw new Error("Anthropic rejected ANTHROPIC_API_KEY (401).");
    throw error;
  }
}

/**
 * Classifies every candidate, reusing cached results for repositories whose
 * name, description, topics and language haven't changed. Heuristic fallbacks
 * are never cached, so the next run retries them with the model.
 */
export async function classifyCandidates(
  candidates: readonly Candidate[],
  mode: Mode,
  log: (message: string) => void,
): Promise<{ classifications: Map<number, Classification>; stats: ClassificationStats }> {
  const classifications = new Map<number, Classification>();
  const stats: ClassificationStats = { cached: 0, byModel: 0, byHeuristic: 0, inputTokens: 0, outputTokens: 0, cost: null };
  const model = mode.kind === "claude" ? mode.model : "heuristic";
  const cache = await readCache();
  const fingerprints = new Map(candidates.map((c) => [c.githubId, sha1(classificationFingerprint(c, model))]));

  const pending: Candidate[] = [];
  for (const candidate of candidates) {
    const entry = cache[candidate.githubId];
    if (entry && entry.fingerprint === fingerprints.get(candidate.githubId)) {
      classifications.set(candidate.githubId, entry.classification);
      stats.cached++;
    } else {
      pending.push(candidate);
    }
  }

  const fallBack = (batch: readonly Candidate[]) => {
    for (const candidate of batch) classifications.set(candidate.githubId, classifyHeuristically(candidate));
    stats.byHeuristic += batch.length;
  };

  if (mode.kind === "heuristic") {
    fallBack(pending);
    return { classifications, stats };
  }

  const client = new Anthropic({ maxRetries: 4 });
  // Batches finish concurrently; cache writes are queued so they never interleave.
  let cacheWrites = Promise.resolve();
  const persistCache = () => (cacheWrites = cacheWrites.then(() => writeCache(cache)));
  const batches: Candidate[][] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));
  let done = 0;

  await mapWithConcurrency(batches, CONCURRENCY, async (batch) => {
    try {
      const response = await client.messages.parse({
        model: mode.model,
        max_tokens: 8000,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: classificationRequest(batch) }],
        output_config: { effort: "low", format: zodOutputFormat(BatchResultSchema) },
      });
      stats.inputTokens += response.usage.input_tokens;
      stats.outputTokens += response.usage.output_tokens;

      if (response.stop_reason === "refusal" || !response.parsed_output) {
        log(`  batch not classified (${response.stop_reason}); using keyword rules for ${batch.length} repositories`);
        fallBack(batch);
      } else {
        const { classified, missing } = mergeResults(batch, response.parsed_output.results, mode.model);
        for (const [githubId, classification] of classified) {
          classifications.set(githubId, classification);
          cache[githubId] = { fingerprint: fingerprints.get(githubId)!, classification };
        }
        stats.byModel += classified.size;
        if (missing.length > 0) fallBack(missing);
        await persistCache();
      }
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw error;
      if (error instanceof Anthropic.NotFoundError) throw new Error(`Model "${mode.model}" not found.`);
      const reason = error instanceof Anthropic.APIError ? `API ${error.status}` : String(error);
      log(`  batch failed (${reason}); using keyword rules for ${batch.length} repositories`);
      fallBack(batch);
    }
    done++;
    if (done % 10 === 0 || done === batches.length) log(`  classified ${done}/${batches.length} batches`);
  });

  const price = PRICES[mode.model];
  stats.cost = price ? (stats.inputTokens * price[0] + stats.outputTokens * price[1]) / 1_000_000 : null;
  return { classifications, stats };
}
