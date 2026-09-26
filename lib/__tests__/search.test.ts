import { describe, expect, it } from "vitest";
import { getSampleDataset } from "../repositoryData";
import { computeSearchMask, rankMatches, tokenize } from "../search";

describe("search", () => {
  const { repositories, search } = getSampleDataset();
  const names = (indices: number[]) => indices.map((i) => repositories[i].name);
  const matchNames = (query: string) => {
    const { mask } = computeSearchMask(search, tokenize(query));
    return repositories.filter((_, i) => mask[i]).map((r) => r.name);
  };

  it("tokenizes queries", () => {
    expect(tokenize("  Vector, DATABASE ")).toEqual(["vector", "database"]);
    expect(tokenize("AI / LLM")).toEqual(["ai", "llm"]);
    expect(tokenize("c++ next.js")).toEqual(["c++", "next.js"]);
  });

  it("finds the vector databases", () => {
    const matches = matchNames("vector database");
    expect(matches).toEqual(expect.arrayContaining(["qdrant", "milvus", "weaviate", "chroma", "pgvector"]));
    expect(matches).not.toContain("redis");
  });

  it("requires every token to match", () => {
    const matches = matchNames("react testing");
    expect(matches).toContain("react-testing-library");
    expect(matches).not.toContain("react");
  });

  it("matches owners, topics, categories, platforms and languages", () => {
    expect(matchNames("facebook")).toEqual(expect.arrayContaining(["react", "react-native"]));
    expect(matchNames("vector-search")).toContain("faiss");
    expect(matchNames("observability")).toContain("grafana");
    expect(matchNames("browser extension")).toContain("uBlock");
    expect(matchNames("rust")).toContain("meilisearch");
  });

  it("matches short tokens as whole words only", () => {
    const go = matchNames("go");
    expect(go).toContain("gin");
    expect(go).not.toContain("django");
    expect(go).not.toContain("mongo");
  });

  it("handles simple plurals", () => {
    expect(matchNames("databases")).toContain("qdrant");
    expect(matchNames("libraries").length).toBeGreaterThan(0);
  });

  it("ranks name matches first", () => {
    const top = rankMatches(search, tokenize("react"), { limit: 3 });
    expect(names(top.map((m) => m.index))[0]).toBe("react");
  });

  it("respects the eligible mask", () => {
    const eligible = new Uint8Array(repositories.length);
    const flask = repositories.findIndex((r) => r.name === "flask");
    eligible[flask] = 1;
    const results = rankMatches(search, tokenize("python"), { eligible });
    expect(results.map((m) => m.index)).toEqual([flask]);
  });
});
