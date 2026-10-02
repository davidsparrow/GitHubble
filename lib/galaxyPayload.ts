import { CLUSTER_IDS, PLATFORMS, PROBLEM_CATEGORIES, type ClusterId, type Platform, type ProblemCategory } from "./taxonomy";
import type { Repository } from "./types";

/**
 * Wire format for `/api/galaxy`: one tuple per repository instead of an object,
 * roughly halving the payload for a galaxy of a few thousand stars.
 */

export const GALAXY_PAYLOAD_VERSION = 1;

type CompactRepository = [
  owner: string,
  name: string,
  description: string,
  stars: number,
  language: string,
  topics: string[],
  problemCategory: ProblemCategory,
  platform: Platform,
  clusterId: ClusterId,
  x: number,
  y: number,
  z: number,
  updatedAt: string,
  homepageUrl: string | null,
];

export type GalaxyPayload = {
  version: typeof GALAXY_PAYLOAD_VERSION;
  /** When the importer last refreshed the galaxy (ISO-8601). */
  indexedAt: string;
  repositories: CompactRepository[];
};

const round = (value: number) => Math.round(value * 100) / 100;

export function encodeGalaxy(repositories: readonly Repository[], indexedAt: string): GalaxyPayload {
  return {
    version: GALAXY_PAYLOAD_VERSION,
    indexedAt,
    repositories: repositories.map((repo) => [
      repo.owner,
      repo.name,
      repo.description,
      repo.stars,
      repo.language,
      repo.topics,
      repo.problemCategory,
      repo.platform,
      repo.clusterId,
      round(repo.x),
      round(repo.y),
      round(repo.z),
      repo.updatedAt,
      repo.homepageUrl ?? null,
    ]),
  };
}

const PROBLEMS = new Set<string>(PROBLEM_CATEGORIES);
const PLATFORM_SET = new Set<string>(PLATFORMS);
const CLUSTERS = new Set<string>(CLUSTER_IDS);

/** Decodes a payload, dropping malformed rows. Throws if the payload itself is unusable. */
export function decodeGalaxy(payload: unknown): { repositories: Repository[]; indexedAt: string } {
  const candidate = payload as Partial<GalaxyPayload> | null;
  if (!candidate || candidate.version !== GALAXY_PAYLOAD_VERSION || !Array.isArray(candidate.repositories)) {
    throw new Error("Unsupported galaxy payload");
  }
  const repositories: Repository[] = [];
  for (const row of candidate.repositories) {
    if (!Array.isArray(row) || row.length < 14) continue;
    const [owner, name, description, stars, language, topics, problemCategory, platform, clusterId, x, y, z, updatedAt, homepageUrl] =
      row;
    if (!PROBLEMS.has(problemCategory) || !PLATFORM_SET.has(platform) || !CLUSTERS.has(clusterId)) continue;
    if (![stars, x, y, z].every(Number.isFinite)) continue;
    repositories.push({
      id: `${owner}/${name}`,
      owner,
      name,
      description,
      stars,
      language,
      topics: Array.isArray(topics) ? topics : [],
      problemCategory,
      platform,
      clusterId,
      x,
      y,
      z,
      githubUrl: `https://github.com/${owner}/${name}`,
      updatedAt,
      ...(homepageUrl ? { homepageUrl } : {}),
    });
  }
  return { repositories, indexedAt: String(candidate.indexedAt ?? "") };
}
