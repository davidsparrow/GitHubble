import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeItem, type Candidate, type GitHubSearchItem } from "../../lib/importer/candidate";

const API = "https://api.github.com";
const CACHE_DIR = path.join(".cache", "github");
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
/** Authenticated search allows 30 requests a minute. */
const SEARCH_INTERVAL_MS = 2100;
const MAX_ATTEMPTS = 6;

type SearchResponse = { total_count: number; incomplete_results: boolean; items: GitHubSearchItem[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GitHubClient {
  private nextRequestAt = 0;

  constructor(
    private readonly token: string,
    private readonly options: { useCache: boolean; log: (message: string) => void },
  ) {}

  /** Top repositories for a search query, most-starred first, already normalized. */
  async searchRepositories(query: string): Promise<Candidate[]> {
    const url = `${API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=100`;
    const body = await this.getJson<SearchResponse>(url);
    return body.items.map(normalizeItem).filter((candidate): candidate is Candidate => candidate !== null);
  }

  private async getJson<T>(url: string): Promise<T> {
    const cacheFile = path.join(CACHE_DIR, `${createHash("sha1").update(url).digest("hex")}.json`);
    if (this.options.useCache) {
      try {
        const cached = JSON.parse(await readFile(cacheFile, "utf8")) as { savedAt: number; body: T };
        if (Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.body;
      } catch {
        // Not cached yet.
      }
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.throttle();
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "githubble-importer",
        },
      });

      if (response.ok) {
        const body = (await response.json()) as T;
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(cacheFile, JSON.stringify({ savedAt: Date.now(), body }));
        return body;
      }
      if (response.status === 401) throw new Error("GitHub rejected the token (401). Check GITHUB_TOKEN.");

      const rateLimited =
        response.status === 429 ||
        (response.status === 403 &&
          (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")));
      if (rateLimited) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const reset = Number(response.headers.get("x-ratelimit-reset"));
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : reset > 0 ? Math.max(1000, reset * 1000 - Date.now() + 1000) : 60_000;
        this.options.log(`  GitHub rate limit reached; waiting ${Math.ceil(waitMs / 1000)}s`);
        await sleep(waitMs);
        continue;
      }
      if (response.status >= 500) {
        await sleep(2000 * attempt);
        continue;
      }
      throw new Error(`GitHub ${response.status} for ${url}: ${(await response.text()).slice(0, 300)}`);
    }
    throw new Error(`GitHub request kept failing after ${MAX_ATTEMPTS} attempts: ${url}`);
  }

  private async throttle() {
    const now = Date.now();
    const wait = this.nextRequestAt - now;
    if (wait > 0) await sleep(wait);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + SEARCH_INTERVAL_MS;
  }
}
