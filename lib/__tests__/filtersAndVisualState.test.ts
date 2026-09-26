import { describe, expect, it } from "vitest";
import { computeFilterMask, EMPTY_FILTERS, facetCounts, toggleValue } from "../filters";
import { getSampleDataset } from "../repositoryData";
import { computeStarTargets, VISIBILITY } from "../visualState";

describe("filters", () => {
  const { repositories } = getSampleDataset();

  it("passes everything when no filter is active", () => {
    expect(computeFilterMask(repositories, EMPTY_FILTERS)).toEqual({ mask: null, count: repositories.length });
  });

  it("ORs values within a family and ANDs across families", () => {
    const filters = { ...EMPTY_FILTERS, languages: ["Rust", "Go"], problems: ["Database"] };
    const { mask, count } = computeFilterMask(repositories, filters);
    const passing = repositories.filter((_, i) => mask![i]);
    expect(count).toBe(passing.length);
    expect(passing.length).toBeGreaterThan(3);
    for (const repo of passing) {
      expect(["Rust", "Go"]).toContain(repo.language);
      expect(repo.problemCategory).toBe("Database");
    }
  });

  it("counts facets against the other active families", () => {
    const filters = { ...EMPTY_FILTERS, problems: ["Database"] };
    const counts = facetCounts(repositories, filters, "languages");
    const rustDatabases = repositories.filter((r) => r.language === "Rust" && r.problemCategory === "Database").length;
    expect(counts.get("Rust")).toBe(rustDatabases);
    // A family's own selection doesn't narrow its own counts.
    const problemCounts = facetCounts(repositories, filters, "problems");
    expect(problemCounts.get("Search")).toBeGreaterThan(0);
  });

  it("toggles values", () => {
    expect(toggleValue(["Go"], "Rust")).toEqual(["Go", "Rust"]);
    expect(toggleValue(["Go", "Rust"], "Go")).toEqual(["Rust"]);
  });
});

describe("visual state", () => {
  const clusterIndex = Uint8Array.from([0, 0, 1, 1]);
  const run = (inputs: Partial<Parameters<typeof computeStarTargets>[0]>) => {
    const visibility = new Float32Array(4);
    const highlight = new Float32Array(4);
    computeStarTargets(
      { filterMask: null, searchMask: null, similar: null, anchorIndex: -1, selectedIndex: -1, clusterIndex, ...inputs },
      visibility,
      highlight,
    );
    return { visibility: [...visibility], highlight: [...highlight] };
  };

  it("leaves every star untouched by default", () => {
    expect(run({})).toEqual({ visibility: [1, 1, 1, 1], highlight: [0, 0, 0, 0] });
  });

  it("dims filtered-out stars more than search misses", () => {
    const { visibility, highlight } = run({
      filterMask: Uint8Array.from([1, 1, 1, 0]),
      searchMask: Uint8Array.from([1, 0, 1, 1]),
    });
    expect(visibility[3]).toBeCloseTo(VISIBILITY.filteredOut);
    expect(visibility[1]).toBeCloseTo(VISIBILITY.searchMiss);
    expect(highlight[0]).toBeGreaterThan(0);
    expect(highlight[3]).toBe(0);
  });

  it("spotlights the anchor and its neighbors in similar mode", () => {
    const { visibility, highlight } = run({ similar: new Map([[1, 1]]), anchorIndex: 0, selectedIndex: 0 });
    expect(highlight[0]).toBe(1);
    expect(highlight[1]).toBe(1);
    expect(visibility[2]).toBeCloseTo(VISIBILITY.similarMiss);
  });

  it("keeps the selected star bright and softens other neighborhoods", () => {
    const { visibility } = run({ selectedIndex: 0, filterMask: Uint8Array.from([0, 1, 1, 1]) });
    expect(visibility[0]).toBe(1);
    expect(visibility[1]).toBeCloseTo(VISIBILITY.sameNeighborhood);
    expect(visibility[2]).toBeCloseTo(VISIBILITY.otherNeighborhood);
  });
});
