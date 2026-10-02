/**
 * What the importer asks GitHub for. Each topic is searched separately (top
 * repositories by stars), and the galaxy is filled by taking turns across
 * topics, so a few huge ecosystems can't crowd out the rest.
 *
 * Topics are grouped by the neighborhood they mostly feed, purely for
 * readability; Claude decides each repository's actual classification.
 */
export const SEARCH_TOPICS: readonly string[] = [
  // AI & Machine Learning
  "llm", "large-language-models", "machine-learning", "deep-learning", "generative-ai", "rag",
  "ai-agents", "computer-vision", "nlp", "stable-diffusion", "speech-recognition", "mlops",
  // Data & Search
  "database", "vector-database", "orm", "sql", "search-engine", "full-text-search", "data-engineering",
  "etl", "dataframe", "data-visualization", "stream-processing", "web-scraping", "crawler",
  // Web Development
  "web-framework", "react", "vue", "svelte", "nextjs", "django", "fastapi", "rest-api", "graphql",
  "ui-components", "design-system", "css-framework", "static-site-generator",
  // Mobile & Desktop
  "android", "ios", "flutter", "react-native", "swiftui", "jetpack-compose", "electron", "tauri",
  "desktop-app",
  // Media & Graphics
  "game-engine", "3d", "webgl", "video", "audio", "image-processing", "pdf",
  // Developer Tools
  "cli", "developer-tools", "terminal", "code-editor", "linter", "formatter", "bundler", "compiler",
  "package-manager", "git", "testing", "e2e-testing", "automation", "workflow-automation",
  "home-automation", "embedded", "iot", "esp32",
  // Cloud & Infrastructure
  "kubernetes", "docker", "devops", "infrastructure-as-code", "ci-cd", "serverless", "self-hosted",
  "monitoring", "observability", "logging", "proxy", "networking", "vpn",
  // Security & Identity
  "security", "authentication", "oauth2", "encryption", "penetration-testing", "password-manager",
  "privacy", "browser-extension",
];

export type SearchOptions = {
  minStars: number;
  /** Only repositories pushed to on or after this date (YYYY-MM-DD). */
  activeSince: string;
};

export function buildSearchQuery(topic: string, { minStars, activeSince }: SearchOptions): string {
  return `topic:${topic} stars:>=${minStars} pushed:>=${activeSince} archived:false fork:false`;
}

/** YYYY-MM-DD for `months` months before `from`. */
export function monthsAgo(months: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}
