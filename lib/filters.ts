import type { Repository } from "./types";

/** Values are OR-ed within a family and AND-ed across families. */
export type FilterKey = "languages" | "problems" | "platforms";

export type Filters = Record<FilterKey, string[]>;

export const FILTER_KEYS: readonly FilterKey[] = ["languages", "problems", "platforms"];

export const EMPTY_FILTERS: Filters = { languages: [], problems: [], platforms: [] };

export const FILTER_LABELS: Record<FilterKey, string> = {
  languages: "Language",
  problems: "Problem Solved",
  platforms: "Platform",
};

const FIELD: Record<FilterKey, (repo: Repository) => string> = {
  languages: (repo) => repo.language,
  problems: (repo) => repo.problemCategory,
  platforms: (repo) => repo.platform,
};

export function filterValue(repo: Repository, key: FilterKey): string {
  return FIELD[key](repo);
}

export function hasActiveFilters(filters: Filters): boolean {
  return FILTER_KEYS.some((key) => filters[key].length > 0);
}

export function activeFilterCount(filters: Filters): number {
  return FILTER_KEYS.reduce((sum, key) => sum + filters[key].length, 0);
}

export function matchesFilters(repo: Repository, filters: Filters, ignore?: FilterKey): boolean {
  for (const key of FILTER_KEYS) {
    if (key === ignore) continue;
    const selected = filters[key];
    if (selected.length > 0 && !selected.includes(FIELD[key](repo))) return false;
  }
  return true;
}

/** Returns null when no filter is active (everything passes). */
export function computeFilterMask(
  repositories: readonly Repository[],
  filters: Filters,
): { mask: Uint8Array | null; count: number } {
  if (!hasActiveFilters(filters)) return { mask: null, count: repositories.length };
  const mask = new Uint8Array(repositories.length);
  let count = 0;
  repositories.forEach((repo, i) => {
    if (matchesFilters(repo, filters)) {
      mask[i] = 1;
      count++;
    }
  });
  return { mask, count };
}

/**
 * How many repositories each value of `key` would match given the *other*
 * active families — the numbers shown next to each option.
 */
export function facetCounts(repositories: readonly Repository[], filters: Filters, key: FilterKey): Map<string, number> {
  const counts = new Map<string, number>();
  for (const repo of repositories) {
    if (!matchesFilters(repo, filters, key)) continue;
    const value = FIELD[key](repo);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** Distinct values of `key`, most common first. */
export function facetValues(repositories: readonly Repository[], key: FilterKey): string[] {
  const counts = facetCounts(repositories, EMPTY_FILTERS, key);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value]) => value);
}

export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
