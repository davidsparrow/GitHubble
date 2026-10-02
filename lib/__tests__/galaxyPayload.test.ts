import { describe, expect, it } from "vitest";
import { decodeGalaxy, encodeGalaxy, GALAXY_PAYLOAD_VERSION } from "../galaxyPayload";
import { getSampleDataset } from "../repositoryData";

describe("galaxy payload", () => {
  const { repositories } = getSampleDataset();

  it("round-trips repositories (coordinates rounded to 0.01)", () => {
    const payload = JSON.parse(JSON.stringify(encodeGalaxy(repositories, "2026-10-02T00:00:00Z")));
    const decoded = decodeGalaxy(payload);
    expect(decoded.indexedAt).toBe("2026-10-02T00:00:00Z");
    expect(decoded.repositories).toHaveLength(repositories.length);
    decoded.repositories.forEach((repo, i) => {
      const original = repositories[i];
      expect(repo.id).toBe(original.id);
      expect(repo.stars).toBe(original.stars);
      expect(repo.topics).toEqual(original.topics);
      expect(repo.problemCategory).toBe(original.problemCategory);
      expect(repo.githubUrl).toBe(original.githubUrl);
      expect(Math.abs(repo.x - original.x)).toBeLessThanOrEqual(0.005);
    });
  });

  it("is much smaller than plain JSON objects", () => {
    const compact = JSON.stringify(encodeGalaxy(repositories, "")).length;
    expect(compact).toBeLessThan(JSON.stringify(repositories).length * 0.75);
  });

  it("rejects unknown versions and drops malformed rows", () => {
    expect(() => decodeGalaxy({ version: 99, repositories: [] })).toThrow();
    expect(() => decodeGalaxy(null)).toThrow();
    const payload = encodeGalaxy(repositories.slice(0, 2), "");
    payload.repositories[1][6] = "Not a category" as never;
    const decoded = decodeGalaxy({ ...payload, repositories: [...payload.repositories, ["too", "short"]] });
    expect(decoded.repositories.map((r) => r.id)).toEqual([repositories[0].id]);
    expect(payload.version).toBe(GALAXY_PAYLOAD_VERSION);
  });
});
