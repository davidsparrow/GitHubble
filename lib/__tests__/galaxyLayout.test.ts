import { describe, expect, it } from "vitest";
import { SAMPLE_REPOSITORY_SEEDS } from "../data/sampleRepositories";
import { buildRepositories, getSampleDataset } from "../repositoryData";
import { CLUSTER_IDS } from "../taxonomy";

describe("galaxy layout", () => {
  const { repositories, clusters } = getSampleDataset();

  it("is deterministic", () => {
    const again = buildRepositories(SAMPLE_REPOSITORY_SEEDS);
    again.forEach((repo, i) => {
      expect(repo.x).toBe(repositories[i].x);
      expect(repo.y).toBe(repositories[i].y);
      expect(repo.z).toBe(repositories[i].z);
    });
  });

  it("keeps every star inside the galaxy disc", () => {
    for (const repo of repositories) {
      expect(Number.isFinite(repo.x) && Number.isFinite(repo.y) && Number.isFinite(repo.z)).toBe(true);
      expect(Math.hypot(repo.x, repo.z)).toBeLessThan(125);
      expect(Math.abs(repo.y)).toBeLessThan(25);
    }
  });

  it("places neighborhoods apart from each other", () => {
    expect(clusters.map((c) => c.id).sort()).toEqual([...CLUSTER_IDS].sort());
    for (const a of clusters) {
      for (const b of clusters) {
        if (a.id >= b.id) continue;
        const distance = Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z);
        expect(distance, `${a.id} ↔ ${b.id}`).toBeGreaterThan(15);
      }
    }
  });

  it("keeps members of a neighborhood closer to their own center than to others", () => {
    let own = 0;
    for (const repo of repositories) {
      const nearest = clusters.reduce((best, c) =>
        Math.hypot(repo.x - c.center.x, repo.z - c.center.z) < Math.hypot(repo.x - best.center.x, repo.z - best.center.z) ? c : best,
      );
      if (nearest.id === repo.clusterId) own++;
    }
    expect(own / repositories.length).toBeGreaterThan(0.9);
  });

  it("puts vector databases next to each other", () => {
    const byName = new Map(repositories.map((r) => [r.name, r]));
    const qdrant = byName.get("qdrant")!;
    const neighbors = ["milvus", "weaviate", "chroma"].map((name) => byName.get(name)!);
    for (const other of neighbors) {
      expect(Math.hypot(qdrant.x - other.x, qdrant.y - other.y, qdrant.z - other.z)).toBeLessThan(18);
    }
  });

  it("does not stack stars on top of each other", () => {
    let overlapping = 0;
    for (let i = 0; i < repositories.length; i++) {
      for (let j = i + 1; j < repositories.length; j++) {
        const a = repositories[i];
        const b = repositories[j];
        if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.5) overlapping++;
      }
    }
    expect(overlapping).toBe(0);
  });
});
