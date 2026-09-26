import { starMagnitude } from "./starScale";
import type { Repository } from "./types";

/**
 * Metadata-based similarity (no embeddings yet):
 *
 *   same problem category        +4
 *   shared GitHub topic          up to +3 each (rare topics weigh more), best three
 *   same neighborhood (cluster)  +2   (only when the category differs)
 *   same platform                +2
 *   same language                +1
 *   description overlap          +0…4
 */

export type SimilarityIndex = {
  topicWeights: Map<string, number>;
  terms: Set<string>[];
};

export type SimilarRepository = {
  index: number;
  score: number;
  sharedTopics: string[];
  /** Short human-readable explanations, strongest first. */
  reasons: string[];
};

const STOPWORDS = new Set(
  (
    "a an and are as at be build building by for from in into is it its of on or that the to with your you " +
    "all any based built easy every fast free great high just like make makes more most new next open " +
    "powerful simple source the their this tool tools using very way what when which while will framework " +
    "library platform application applications apps support written modern official"
  ).split(" "),
);

function descriptionTerms(description: string): Set<string> {
  const terms = new Set<string>();
  for (const raw of description.toLowerCase().split(/[^a-z0-9+#]+/)) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    terms.add(raw.length > 4 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw);
  }
  return terms;
}

export function buildSimilarityIndex(repositories: readonly Repository[]): SimilarityIndex {
  const documentFrequency = new Map<string, number>();
  for (const repo of repositories) {
    for (const topic of new Set(repo.topics)) documentFrequency.set(topic, (documentFrequency.get(topic) ?? 0) + 1);
  }
  const total = Math.max(repositories.length, 2);
  const topicWeights = new Map<string, number>();
  for (const [topic, df] of documentFrequency) {
    const idf = Math.log(total / df) / Math.log(total);
    topicWeights.set(topic, 3 * Math.min(1, Math.max(0.25, idf)));
  }
  return { topicWeights, terms: repositories.map((repo) => descriptionTerms(repo.description)) };
}

export function scoreSimilarity(
  repositories: readonly Repository[],
  index: SimilarityIndex,
  anchorIndex: number,
  candidateIndex: number,
): Omit<SimilarRepository, "index"> {
  const anchor = repositories[anchorIndex];
  const candidate = repositories[candidateIndex];
  const reasons: { text: string; weight: number }[] = [];
  let score = 0;

  const sameCategory = anchor.problemCategory === candidate.problemCategory;
  if (sameCategory) {
    score += 4;
    reasons.push({ text: `Also ${candidate.problemCategory}`, weight: 4 });
  }

  const candidateTopics = new Set(candidate.topics);
  const sharedTopics = anchor.topics
    .filter((topic) => candidateTopics.has(topic))
    .sort((a, b) => (index.topicWeights.get(b) ?? 0) - (index.topicWeights.get(a) ?? 0));
  const topicScore = sharedTopics.slice(0, 3).reduce((sum, topic) => sum + (index.topicWeights.get(topic) ?? 0), 0);
  if (topicScore > 0) {
    score += topicScore;
    reasons.push({ text: `Shares ${sharedTopics.slice(0, 2).join(", ")}`, weight: topicScore + 0.5 });
  }

  if (!sameCategory && anchor.clusterId === candidate.clusterId) {
    score += 2;
    reasons.push({ text: "Same neighborhood", weight: 2 });
  }
  if (anchor.platform === candidate.platform) {
    score += 2;
    reasons.push({ text: `Also ${candidate.platform}`, weight: 1.5 });
  }
  if (anchor.language === candidate.language) {
    score += 1;
    reasons.push({ text: candidate.language, weight: 1 });
  }

  const a = index.terms[anchorIndex];
  const b = index.terms[candidateIndex];
  let overlap = 0;
  for (const term of a) if (b.has(term)) overlap++;
  const union = a.size + b.size - overlap;
  const descriptionScore = union > 0 ? Math.min(4, (overlap / union) * 12) : 0;
  if (descriptionScore > 0) {
    score += descriptionScore;
    if (descriptionScore >= 1.5) reasons.push({ text: "Similar description", weight: descriptionScore });
  }

  reasons.sort((x, y) => y.weight - x.weight);
  return { score, sharedTopics, reasons: reasons.map((r) => r.text) };
}

export function findSimilar(
  repositories: readonly Repository[],
  index: SimilarityIndex,
  anchorIndex: number,
  options: { limit?: number; minScore?: number; eligible?: Uint8Array | null } = {},
): SimilarRepository[] {
  const { limit = 12, minScore = 5, eligible } = options;
  const results: SimilarRepository[] = [];
  for (let i = 0; i < repositories.length; i++) {
    if (i === anchorIndex || (eligible && !eligible[i])) continue;
    const result = scoreSimilarity(repositories, index, anchorIndex, i);
    if (result.score < minScore) continue;
    // A whisper of popularity breaks ties towards projects people know.
    results.push({ index: i, ...result, score: result.score + 0.3 * starMagnitude(repositories[i].stars) });
  }
  results.sort((a, b) => b.score - a.score || a.index - b.index);
  return results.slice(0, limit);
}
