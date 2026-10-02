import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeItem, type Candidate, type GitHubSearchItem } from "../importer/candidate";
import {
  CLASSIFIER_SYSTEM_PROMPT,
  classificationFingerprint,
  classificationRequest,
  mergeResults,
} from "../importer/classification";
import { classifyHeuristically, isLikelyResource } from "../importer/heuristicClassifier";
import { fromGalaxyRow, toRow } from "../importer/rows";
import { buildSearchQuery, monthsAgo, SEARCH_TOPICS } from "../importer/searchQueries";
import { selectDiverse } from "../importer/selection";
import { CLUSTER_IDS, PLATFORMS, PROBLEM_CATEGORIES } from "../taxonomy";

function item(overrides: Partial<GitHubSearchItem> = {}): GitHubSearchItem {
  return {
    id: 1,
    name: "qdrant",
    full_name: "qdrant/qdrant",
    owner: { login: "qdrant" },
    html_url: "https://github.com/qdrant/qdrant",
    description: "Vector database :rocket: for the next generation of AI",
    fork: false,
    archived: false,
    homepage: "qdrant.tech",
    stargazers_count: 23000,
    forks_count: 1500,
    language: "Rust",
    topics: ["Vector-Database", "embeddings"],
    created_at: "2020-05-30T00:00:00Z",
    updated_at: "2026-09-30T00:00:00Z",
    pushed_at: "2026-09-29T00:00:00Z",
    ...overrides,
  };
}

function candidate(id: number, overrides: Partial<Candidate> = {}): Candidate {
  return { ...normalizeItem(item({ id, name: `repo-${id}`, full_name: `owner/repo-${id}` }))!, ...overrides };
}

describe("normalizeItem", () => {
  it("cleans descriptions, homepages and topics", () => {
    const c = normalizeItem(item())!;
    expect(c.description).toBe("Vector database for the next generation of AI");
    expect(c.homepageUrl).toBe("https://qdrant.tech/");
    expect(c.topics).toEqual(["vector-database", "embeddings"]);
    expect(c.language).toBe("Rust");
  });

  it("skips forks, archived repositories and repositories without a description", () => {
    expect(normalizeItem(item({ fork: true }))).toBeNull();
    expect(normalizeItem(item({ archived: true }))).toBeNull();
    expect(normalizeItem(item({ description: "  " }))).toBeNull();
    expect(normalizeItem(item({ description: null }))).toBeNull();
  });

  it("drops homepages that just point back at GitHub, and labels unknown languages", () => {
    const c = normalizeItem(item({ homepage: "https://github.com/qdrant/qdrant", language: null }))!;
    expect(c.homepageUrl).toBeNull();
    expect(c.language).toBe("Other");
  });
});

describe("selectDiverse", () => {
  const a = [candidate(1), candidate(2), candidate(3)];
  const b = [candidate(2), candidate(4)];
  const c = [candidate(5)];

  it("takes turns across topics and skips duplicates", () => {
    expect(selectDiverse([a, b, c], 10).map((x) => x.githubId)).toEqual([1, 2, 5, 3, 4]);
  });

  it("stops at the limit and honors the filter", () => {
    expect(selectDiverse([a, b, c], 3).map((x) => x.githubId)).toEqual([1, 2, 5]);
    expect(selectDiverse([a, b, c], 10, (x) => x.githubId % 2 === 1).map((x) => x.githubId)).toEqual([1, 5, 3]);
  });
});

describe("classification contract", () => {
  it("describes every allowed value in the system prompt", () => {
    for (const value of [...PROBLEM_CATEGORIES, ...PLATFORMS, ...CLUSTER_IDS]) {
      expect(CLASSIFIER_SYSTEM_PROMPT).toContain(value);
    }
  });

  it("numbers repositories in the request", () => {
    const request = classificationRequest([candidate(7), candidate(8)]);
    const json = JSON.parse(request.slice(request.indexOf("[")));
    expect(json.map((r: { id: number }) => r.id)).toEqual([0, 1]);
    expect(json[1].repository).toBe("owner/repo-8");
  });

  it("maps results back by id, ignoring duplicates and unknown ids", () => {
    const batch = [candidate(10), candidate(11), candidate(12)];
    const result = (id: number) => ({ id, problem: "Database", platform: "Server", neighborhood: "data", software: true }) as const;
    const { classified, missing } = mergeResults(batch, [result(0), result(0), result(2), result(9)], "claude-sonnet-5");
    expect([...classified.keys()]).toEqual([10, 12]);
    expect(classified.get(10)?.classifiedBy).toBe("claude-sonnet-5");
    expect(missing.map((c) => c.githubId)).toEqual([11]);
  });

  it("fingerprints what matters (and not topic order)", () => {
    const base = candidate(20, { topics: ["a", "b"] });
    const fp = classificationFingerprint(base, "m");
    expect(classificationFingerprint({ ...base, topics: ["b", "a"] }, "m")).toBe(fp);
    expect(classificationFingerprint({ ...base, description: "changed" }, "m")).not.toBe(fp);
    expect(classificationFingerprint(base, "other-model")).not.toBe(fp);
    expect(classificationFingerprint({ ...base, stars: 99 }, "m")).toBe(fp);
  });
});

describe("heuristic classifier", () => {
  it("recognizes common repositories", () => {
    expect(classifyHeuristically(normalizeItem(item())!)).toMatchObject({ problemCategory: "Database", clusterId: "data", isSoftware: true });
    const flutter = candidate(30, { name: "flutter", topics: ["flutter", "mobile", "android", "ios"], description: "UI toolkit for mobile apps" });
    expect(classifyHeuristically(flutter).clusterId).toBe("apps");
    const scanner = candidate(31, { topics: ["security", "vulnerability", "cli"], description: "Find vulnerabilities" });
    expect(classifyHeuristically(scanner)).toMatchObject({ problemCategory: "Security", clusterId: "security" });
  });

  it("flags lists, books and courses as non-software", () => {
    expect(isLikelyResource(candidate(40, { name: "awesome-python" }))).toBe(true);
    expect(isLikelyResource(candidate(41, { description: "A curated list of awesome Go frameworks" }))).toBe(true);
    expect(isLikelyResource(candidate(42, { topics: ["books", "free"] }))).toBe(true);
    expect(isLikelyResource(candidate(43))).toBe(false);
  });
});

describe("rows", () => {
  it("round-trips a repository through a database row", () => {
    const c = normalizeItem(item())!;
    const classification = classifyHeuristically(c);
    const row = toRow(c, classification, { x: 1, y: 2, z: 3 }, "2026-10-02T00:00:00Z");
    expect(row).toMatchObject({ github_id: 1, in_galaxy: true, cluster_id: "data", classification_model: "heuristic" });
    const repo = fromGalaxyRow(row);
    expect(repo).toMatchObject({ id: "qdrant/qdrant", x: 1, z: 3, homepageUrl: "https://qdrant.tech/", updatedAt: c.pushedAt });
  });

  it("keeps the SQL constraints in sync with the taxonomy", () => {
    const sql = readFileSync(path.join(__dirname, "../../supabase/migrations/20261002000000_create_repositories.sql"), "utf8");
    for (const value of [...PROBLEM_CATEGORIES, ...PLATFORMS, ...CLUSTER_IDS]) expect(sql).toContain(`'${value}'`);
  });
});

describe("search queries", () => {
  it("builds GitHub search syntax", () => {
    expect(buildSearchQuery("llm", { minStars: 1000, activeSince: "2025-04-02" })).toBe(
      "topic:llm stars:>=1000 pushed:>=2025-04-02 archived:false fork:false",
    );
    expect(monthsAgo(18, new Date("2026-10-02T12:00:00Z"))).toBe("2025-04-02");
    expect(new Set(SEARCH_TOPICS).size).toBe(SEARCH_TOPICS.length);
  });
});
