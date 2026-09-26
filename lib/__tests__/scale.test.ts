import { describe, expect, it } from "vitest";
import { SAMPLE_REPOSITORY_SEEDS } from "../data/sampleRepositories";
import { syntheticSeeds } from "../data/syntheticRepositories";
import { buildRepositories, createDataset } from "../repositoryData";
import { computeSearchMask, tokenize } from "../search";
import { findSimilar } from "../similarity";

/** Phase 1 targets ~1,000 repositories; the architecture should stretch to 10,000+. */
describe("at 10,000 repositories", () => {
  const started = performance.now();
  const dataset = createDataset(buildRepositories(syntheticSeeds(SAMPLE_REPOSITORY_SEEDS, 10_000)), "synthetic");
  const buildMs = performance.now() - started;

  it("lays out and indexes the galaxy in a few seconds at most", () => {
    expect(dataset.repositories).toHaveLength(10_000);
    expect(buildMs).toBeLessThan(5000);
    for (const repo of dataset.repositories) {
      expect(Number.isFinite(repo.x) && Number.isFinite(repo.y) && Number.isFinite(repo.z)).toBe(true);
    }
  });

  it("searches and finds neighbors interactively", () => {
    const searchStart = performance.now();
    const { count } = computeSearchMask(dataset.search, tokenize("vector database"));
    const searchMs = performance.now() - searchStart;

    const similarStart = performance.now();
    const similar = findSimilar(dataset.repositories, dataset.similarity, dataset.indexById.get("qdrant/qdrant")!);
    const similarMs = performance.now() - similarStart;

    expect(count).toBeGreaterThan(6);
    expect(similar).toHaveLength(12);
    expect(searchMs).toBeLessThan(100);
    expect(similarMs).toBeLessThan(250);
  });
});
