import { SAMPLE_REPOSITORY_SEEDS, type RepositorySeed } from "./data/sampleRepositories";
import { syntheticSeeds } from "./data/syntheticRepositories";
import { facetValues, type FilterKey } from "./filters";
import { layoutGalaxy, summarizeClusters, type ClusterSummary } from "./galaxyLayout";
import { createRandom, hashString } from "./random";
import { buildSearchIndex, type SearchIndex } from "./search";
import { buildSimilarityIndex, type SimilarityIndex } from "./similarity";
import { CLUSTER_IDS, clusterFor } from "./taxonomy";
import type { Repository } from "./types";

/** "Last updated" dates in the sample universe are generated relative to this snapshot. */
const SAMPLE_SNAPSHOT = Date.UTC(2026, 8, 20);
const DAY = 24 * 60 * 60 * 1000;

/** Normalizes seeds into repositories and assigns neighborhoods and galaxy coordinates. */
export function buildRepositories(seeds: readonly RepositorySeed[]): Repository[] {
  const unplaced = seeds.map((seed) => {
    const [owner, name] = seed.fullName.split("/");
    const recency = createRandom(hashString(`${seed.fullName}:updated`))();
    return {
      id: seed.fullName,
      owner,
      name,
      description: seed.description,
      stars: seed.stars,
      language: seed.language,
      topics: seed.topics,
      problemCategory: seed.problemCategory,
      platform: seed.platform,
      clusterId: clusterFor(seed.problemCategory, seed.platform, seed.cluster),
      githubUrl: `https://github.com/${seed.fullName}`,
      updatedAt: new Date(SAMPLE_SNAPSHOT - Math.round(recency * recency * 240) * DAY).toISOString(),
    };
  });
  const positions = layoutGalaxy(unplaced);
  return unplaced.map((repo, i) => ({ ...repo, ...positions[i] }));
}

/** Everything the app derives once from a set of repositories. */
export type GalaxyDataset = {
  /** Where the repositories came from. */
  source: "sample" | "synthetic";
  repositories: Repository[];
  indexById: Map<string, number>;
  /** Ordinal of each repository's cluster in CLUSTER_IDS (compact, for per-star loops). */
  clusterIndex: Uint8Array;
  clusters: ClusterSummary[];
  /** Filter options per family, most common first. */
  facets: Record<FilterKey, string[]>;
  search: SearchIndex;
  similarity: SimilarityIndex;
  /** Largest in-plane distance of any repository from the galactic core. */
  extent: number;
};

export function createDataset(repositories: Repository[], source: GalaxyDataset["source"] = "sample"): GalaxyDataset {
  return {
    source,
    repositories,
    indexById: new Map(repositories.map((repo, i) => [repo.id, i])),
    clusterIndex: Uint8Array.from(repositories, (repo) => CLUSTER_IDS.indexOf(repo.clusterId)),
    clusters: summarizeClusters(repositories),
    facets: {
      languages: facetValues(repositories, "languages"),
      problems: facetValues(repositories, "problems"),
      platforms: facetValues(repositories, "platforms"),
    },
    search: buildSearchIndex(repositories),
    similarity: buildSimilarityIndex(repositories),
    extent: repositories.reduce((max, repo) => Math.max(max, Math.hypot(repo.x, repo.z)), 0),
  };
}

let sampleDataset: GalaxyDataset | null = null;

/** The Phase 1 sample universe (built lazily, once). */
export function getSampleDataset(): GalaxyDataset {
  sampleDataset ??= createDataset(buildRepositories(SAMPLE_REPOSITORY_SEEDS));
  return sampleDataset;
}

const MAX_STRESS_REPOSITORIES = 50_000;

/**
 * The dataset the app starts with: the sample universe, or a synthetic one of
 * N repositories when the page is opened with `?stress=N` (performance testing).
 */
export function loadInitialDataset(): GalaxyDataset {
  const requested = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("stress"));
  if (!Number.isFinite(requested) || requested <= SAMPLE_REPOSITORY_SEEDS.length) return getSampleDataset();
  const count = Math.min(Math.floor(requested), MAX_STRESS_REPOSITORIES);
  return createDataset(buildRepositories(syntheticSeeds(SAMPLE_REPOSITORY_SEEDS, count)), "synthetic");
}
