import { starMagnitude } from "./starScale";
import type { Repository } from "./types";

/**
 * Local search across name, owner, description, topics, problem category,
 * platform and language. Every query token must match somewhere (AND); results
 * are ranked by where they matched, with popularity as a tie-breaker.
 */

export type SearchIndex = {
  haystacks: string[];
  words: Set<string>[];
  names: string[];
  owners: string[];
  topics: string[][];
  facets: string[][];
  descriptions: string[];
  magnitudes: Float32Array;
};

const WORD_SPLIT = /[^a-z0-9#+]+/;

export function buildSearchIndex(repositories: readonly Repository[]): SearchIndex {
  const index: SearchIndex = {
    haystacks: [],
    words: [],
    names: [],
    owners: [],
    topics: [],
    facets: [],
    descriptions: [],
    magnitudes: new Float32Array(repositories.length),
  };
  repositories.forEach((repo, i) => {
    const topics = repo.topics.map((t) => t.toLowerCase());
    const facets = [repo.problemCategory, repo.platform, repo.language].map((f) => f.toLowerCase());
    const haystack = [
      repo.owner,
      repo.name,
      repo.name.replace(/[-_.]/g, " "),
      repo.description,
      topics.join(" "),
      topics.join(" ").replace(/-/g, " "),
      facets.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    index.haystacks.push(haystack);
    index.words.push(new Set(haystack.split(WORD_SPLIT).filter(Boolean)));
    index.names.push(repo.name.toLowerCase());
    index.owners.push(repo.owner.toLowerCase());
    index.topics.push(topics);
    index.facets.push(facets);
    index.descriptions.push(repo.description.toLowerCase());
    index.magnitudes[i] = starMagnitude(repo.stars);
  });
  return index;
}

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.replace(/^[^a-z0-9#+]+|[^a-z0-9#+]+$/g, ""))
    .filter(Boolean);
}

/** The token plus naive singular forms ("databases" → "database", "libraries" → "library"). */
function variants(token: string): string[] {
  if (token.length > 4 && token.endsWith("ies")) return [token, `${token.slice(0, -3)}y`];
  if (token.length > 3 && /(sh|ch|x|ss)es$/.test(token)) return [token, token.slice(0, -2)];
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return [token, token.slice(0, -1)];
  return [token];
}

/** Very short tokens ("go", "ai", "c") only match whole words to avoid noise like "go" ⊂ "django". */
function contains(text: string, words: Set<string>, value: string): boolean {
  return value.length <= 2 ? words.has(value) : text.includes(value);
}

function matchesToken(index: SearchIndex, i: number, token: string): boolean {
  return variants(token).some((v) => contains(index.haystacks[i], index.words[i], v));
}

export function matchesQuery(index: SearchIndex, i: number, tokens: readonly string[]): boolean {
  return tokens.every((token) => matchesToken(index, i, token));
}

export function computeSearchMask(index: SearchIndex, tokens: readonly string[]): { mask: Uint8Array; count: number } {
  const mask = new Uint8Array(index.haystacks.length);
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (matchesQuery(index, i, tokens)) {
      mask[i] = 1;
      count++;
    }
  }
  return { mask, count };
}

function tokenScore(index: SearchIndex, i: number, value: string): number {
  const name = index.names[i];
  let score = 0;

  if (name === value) score += 120;
  else if (name.startsWith(value)) score += 70;
  else if (value.length > 2 && name.includes(value)) score += 45;

  const owner = index.owners[i];
  if (owner === value) score += 35;
  else if (value.length > 2 && owner.includes(value)) score += 15;

  const topics = index.topics[i];
  if (topics.includes(value)) score += 35;
  else if (value.length > 2 && topics.some((t) => t.includes(value))) score += 18;

  const facets = index.facets[i];
  if (facets.some((f) => f === value || f.split(WORD_SPLIT).includes(value))) score += 30;
  else if (value.length > 2 && facets.some((f) => f.includes(value))) score += 15;

  if (value.length > 2 && index.descriptions[i].includes(value)) score += 10;

  return score;
}

export function scoreRepository(index: SearchIndex, i: number, tokens: readonly string[]): number {
  let total = 0;
  for (const token of tokens) {
    total += Math.max(...variants(token).map((v) => tokenScore(index, i, v)));
  }
  return total + 8 * index.magnitudes[i];
}

export type RankedMatch = { index: number; score: number };

/** Best matches first. `eligible` (e.g. the filter mask) restricts the candidates. */
export function rankMatches(
  index: SearchIndex,
  tokens: readonly string[],
  options: { eligible?: Uint8Array | null; limit?: number } = {},
): RankedMatch[] {
  const { eligible, limit = 8 } = options;
  if (tokens.length === 0) return [];
  const results: RankedMatch[] = [];
  for (let i = 0; i < index.haystacks.length; i++) {
    if (eligible && !eligible[i]) continue;
    if (!matchesQuery(index, i, tokens)) continue;
    results.push({ index: i, score: scoreRepository(index, i, tokens) });
  }
  results.sort((a, b) => b.score - a.score || a.index - b.index);
  return results.slice(0, limit);
}
