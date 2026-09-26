import { describe, expect, it } from "vitest";
import { getSampleDataset } from "../repositoryData";
import { findSimilar } from "../similarity";

describe("similarity", () => {
  const { repositories, similarity, indexById } = getSampleDataset();
  const similarNames = (id: string, limit = 12) =>
    findSimilar(repositories, similarity, indexById.get(id)!, { limit }).map((s) => repositories[s.index].name);

  it("surfaces the other vector databases for qdrant", () => {
    const top = similarNames("qdrant/qdrant", 6);
    expect(top).toEqual(expect.arrayContaining(["milvus", "weaviate", "chroma"]));
  });

  it("connects related projects across categories", () => {
    // faiss is a Search library but shares embeddings/similarity-search topics with vector databases.
    expect(similarNames("qdrant/qdrant")).toContain("faiss");
  });

  it("finds UI siblings for shadcn/ui", () => {
    expect(similarNames("shadcn-ui/ui", 8)).toEqual(expect.arrayContaining(["primitives", "material-ui"]));
  });

  it("never returns the anchor and sorts by score", () => {
    const anchor = indexById.get("facebook/react")!;
    const results = findSimilar(repositories, similarity, anchor);
    expect(results.some((r) => r.index === anchor)).toBe(false);
    for (let i = 1; i < results.length; i++) expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    expect(results.every((r) => r.reasons.length > 0)).toBe(true);
  });

  it("respects eligibility", () => {
    const anchor = indexById.get("qdrant/qdrant")!;
    const eligible = new Uint8Array(repositories.length);
    const milvus = indexById.get("milvus-io/milvus")!;
    eligible[milvus] = 1;
    expect(findSimilar(repositories, similarity, anchor, { eligible }).map((r) => r.index)).toEqual([milvus]);
  });
});
