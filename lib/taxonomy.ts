/**
 * GitHubble's classification vocabulary. "Problem Solved" and "Platform" are
 * GitHubble-generated taxonomies (deliberately broad for the MVP); clusters are
 * the galaxy neighborhoods that repositories are laid out in.
 */

export const PROBLEM_CATEGORIES = [
  "AI / LLM",
  "Database",
  "Authentication",
  "UI Components",
  "Web Framework",
  "Developer Tools",
  "Testing",
  "Automation",
  "Search",
  "Observability",
  "Deployment",
  "Scraping",
  "Media",
  "Networking",
  "Security",
  "Data Processing",
] as const;

export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

export const PLATFORMS = [
  "Web",
  "Server",
  "CLI",
  "iOS",
  "Android",
  "Desktop",
  "Browser Extension",
  "Embedded",
  "Cross-platform",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const CLUSTER_IDS = ["devtools", "web", "apps", "media", "ai", "data", "infra", "security"] as const;

export type ClusterId = (typeof CLUSTER_IDS)[number];

export type ClusterDefinition = {
  id: ClusterId;
  label: string;
  /** Soft stellar tint for the neighborhood's stars (sRGB hex). */
  color: string;
  /** Spiral arm the neighborhood sits on, and its order from the core outwards. */
  arm: 0 | 1;
  order: number;
};

export const CLUSTERS: readonly ClusterDefinition[] = [
  { id: "devtools", label: "Developer Tools", color: "#d2dbff", arm: 0, order: 0 },
  { id: "web", label: "Web Development", color: "#8fb6ff", arm: 0, order: 1 },
  { id: "apps", label: "Mobile & Desktop", color: "#ffadc6", arm: 0, order: 2 },
  { id: "media", label: "Media & Graphics", color: "#d6a6ff", arm: 0, order: 3 },
  { id: "ai", label: "AI & Machine Learning", color: "#ffd08a", arm: 1, order: 0 },
  { id: "data", label: "Data & Search", color: "#86e0f0", arm: 1, order: 1 },
  { id: "infra", label: "Cloud & Infrastructure", color: "#aaa6ff", arm: 1, order: 2 },
  { id: "security", label: "Security & Identity", color: "#ff9f8c", arm: 1, order: 3 },
];

export const CLUSTER_BY_ID = Object.fromEntries(CLUSTERS.map((cluster) => [cluster.id, cluster])) as Record<
  ClusterId,
  ClusterDefinition
>;

/** Default neighborhood for each problem category. */
const CATEGORY_CLUSTER: Record<ProblemCategory, ClusterId> = {
  "AI / LLM": "ai",
  Database: "data",
  Search: "data",
  "Data Processing": "data",
  Scraping: "data",
  "Web Framework": "web",
  "UI Components": "web",
  "Developer Tools": "devtools",
  Testing: "devtools",
  Automation: "devtools",
  Deployment: "infra",
  Observability: "infra",
  Networking: "infra",
  Authentication: "security",
  Security: "security",
  Media: "media",
};

/**
 * Picks the galaxy neighborhood for a repository. Native mobile code gravitates to
 * the Mobile & Desktop arm regardless of what it does; an explicit override wins.
 */
export function clusterFor(problem: ProblemCategory, platform: Platform, override?: ClusterId): ClusterId {
  if (override) return override;
  if (platform === "iOS" || platform === "Android") return "apps";
  return CATEGORY_CLUSTER[problem];
}

/** GitHub linguist colors, lightened where the original disappears on a dark background. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Swift: "#f05138",
  Java: "#b07219",
  Kotlin: "#a97bff",
  "C++": "#f34b7d",
  C: "#8d96a6",
  "C#": "#2fa84f",
  PHP: "#7a86b8",
  Ruby: "#c0392b",
  Dart: "#00b4ab",
  Scala: "#dc322f",
  Elixir: "#9b6fb0",
  Clojure: "#db5855",
  Shell: "#89e051",
  Zig: "#ec915c",
  Svelte: "#ff3e00",
  "Objective-C": "#438eff",
  "Vim Script": "#199f4b",
};

export function languageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? "#8b93a8";
}
