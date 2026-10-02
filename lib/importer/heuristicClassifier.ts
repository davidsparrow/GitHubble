import { clusterFor, type Platform, type ProblemCategory } from "../taxonomy";
import type { Candidate } from "./candidate";
import type { Classification } from "./classification";

/**
 * Keyword rules over topics and description: a free, deterministic fallback
 * for `--heuristic` runs and for any batch the model couldn't classify.
 */

const PROBLEM_KEYWORDS: [ProblemCategory, string[]][] = [
  ["AI / LLM", ["llm", "llms", "machine-learning", "deep-learning", "ai", "artificial-intelligence", "gpt", "chatgpt", "openai", "langchain", "rag", "agents", "ai-agents", "neural-network", "computer-vision", "nlp", "diffusion", "stable-diffusion", "transformers", "pytorch", "tensorflow", "ollama", "llama", "generative-ai", "speech-recognition", "mlops"]],
  ["Database", ["database", "databases", "sql", "nosql", "postgres", "postgresql", "mysql", "sqlite", "redis", "mongodb", "orm", "key-value", "vector-database", "graph-database", "time-series", "olap", "cache"]],
  ["Search", ["search", "search-engine", "full-text-search", "elasticsearch", "vector-search", "similarity-search", "indexing"]],
  ["Data Processing", ["data-engineering", "etl", "dataframe", "data-analysis", "big-data", "data-science", "stream-processing", "kafka", "spark", "data-visualization", "jupyter", "pipeline", "pandas", "business-intelligence"]],
  ["Scraping", ["scraping", "web-scraping", "crawler", "scraper", "spider", "crawling"]],
  ["Web Framework", ["web-framework", "framework", "nextjs", "react", "vue", "svelte", "angular", "django", "flask", "fastapi", "express", "rails", "laravel", "spring", "ssr", "static-site-generator", "rest-api", "graphql"]],
  ["UI Components", ["ui", "components", "component-library", "ui-components", "design-system", "css", "css-framework", "tailwindcss", "icons", "animation", "charts"]],
  ["Testing", ["testing", "test", "tests", "e2e", "e2e-testing", "unit-testing", "test-automation", "mocking", "load-testing"]],
  ["Automation", ["automation", "workflow", "workflow-automation", "home-automation", "bot", "rpa", "no-code", "low-code"]],
  ["Deployment", ["kubernetes", "k8s", "docker", "devops", "deployment", "ci", "ci-cd", "infrastructure-as-code", "terraform", "helm", "serverless", "paas", "containers", "gitops"]],
  ["Observability", ["monitoring", "observability", "logging", "logs", "metrics", "tracing", "apm", "alerting", "analytics"]],
  ["Networking", ["proxy", "networking", "http", "http-client", "vpn", "dns", "websocket", "tunnel", "network", "p2p", "grpc", "rpc"]],
  ["Security", ["security", "pentest", "penetration-testing", "vulnerability", "encryption", "cryptography", "malware", "firewall", "privacy", "password-manager", "ctf", "hacking"]],
  ["Authentication", ["authentication", "auth", "oauth", "oauth2", "oidc", "sso", "identity", "jwt", "login", "saml"]],
  ["Media", ["video", "audio", "image", "images", "music", "game-engine", "gamedev", "3d", "graphics", "webgl", "opengl", "pdf", "photo", "photos", "media", "ffmpeg"]],
  ["Developer Tools", ["cli", "developer-tools", "devtools", "terminal", "editor", "ide", "linter", "formatter", "compiler", "bundler", "package-manager", "git", "vscode", "neovim", "shell", "programming-language", "debugger", "embedded", "esp32", "arduino"]],
];

const PLATFORM_KEYWORDS: [Platform, string[]][] = [
  ["Browser Extension", ["browser-extension", "chrome-extension", "firefox-extension", "extension", "userscript"]],
  ["iOS", ["ios", "swiftui", "iphone", "ipad"]],
  ["Android", ["android", "jetpack-compose"]],
  ["Embedded", ["embedded", "esp32", "esp8266", "arduino", "microcontroller", "iot", "raspberry-pi", "firmware", "rtos"]],
  ["Desktop", ["desktop", "desktop-app", "electron", "tauri", "macos", "windows", "linux-desktop"]],
  ["CLI", ["cli", "terminal", "command-line", "shell", "tui"]],
  ["Web", ["web", "frontend", "react", "vue", "svelte", "css", "browser", "webapp", "nextjs"]],
  ["Server", ["server", "backend", "self-hosted", "api", "database", "microservices", "kubernetes"]],
];

const RESOURCE_TOPICS = new Set(["awesome", "awesome-list", "awesome-lists", "list", "books", "book", "tutorial", "tutorials", "course", "courses", "interview", "interview-questions", "roadmap", "learning", "education", "cheatsheet", "cheat-sheet", "resources", "free-programming-books"]);

function words(candidate: Candidate): string[] {
  return candidate.description.toLowerCase().split(/[^a-z0-9+#-]+/).filter(Boolean);
}

function bestMatch<T>(rules: [T, string[]][], topics: Set<string>, text: string[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const [value, keywords] of rules) {
    let score = 0;
    for (const keyword of keywords) {
      if (topics.has(keyword)) score += 3;
      if (text.includes(keyword)) score += 1;
    }
    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  }
  return best;
}

export function isLikelyResource(candidate: Candidate): boolean {
  const name = candidate.name.toLowerCase();
  if (/(^|-)awesome(-|$)|interview|roadmap|cheat-?sheet|(^|-)books?(-|$)|tutorials?|course/.test(name)) return true;
  if (candidate.topics.some((t) => RESOURCE_TOPICS.has(t))) return true;
  return /curated list|collection of (awesome|resources|links)|list of (resources|awesome)/i.test(candidate.description);
}

export function classifyHeuristically(candidate: Candidate): Classification {
  const topics = new Set(candidate.topics);
  const text = words(candidate);
  const problemCategory = bestMatch(PROBLEM_KEYWORDS, topics, text) ?? "Developer Tools";
  const platform = bestMatch(PLATFORM_KEYWORDS, topics, text) ?? "Cross-platform";
  const crossPlatformApps = ["flutter", "react-native", "electron", "tauri", "compose-multiplatform"].some((t) => topics.has(t));
  return {
    problemCategory,
    platform,
    clusterId: crossPlatformApps ? "apps" : clusterFor(problemCategory, platform),
    isSoftware: !isLikelyResource(candidate),
    classifiedBy: "heuristic",
  };
}
