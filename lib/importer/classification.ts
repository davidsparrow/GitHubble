import { CLUSTERS, PLATFORMS, PROBLEM_CATEGORIES, type ClusterId, type Platform, type ProblemCategory } from "../taxonomy";
import type { Candidate } from "./candidate";

/** Bump when the taxonomy or the instructions change, so cached classifications are redone. */
export const CLASSIFICATION_VERSION = 1;

export type Classification = {
  problemCategory: ProblemCategory;
  platform: Platform;
  clusterId: ClusterId;
  /** False for awesome-lists, books, courses and other non-software repositories. */
  isSoftware: boolean;
  /** Model id, or "heuristic". */
  classifiedBy: string;
};

const PROBLEM_GUIDE: Record<ProblemCategory, string> = {
  "AI / LLM": "ML/LLM frameworks, models, inference, LLM apps and agents, computer vision, speech",
  Database: "databases, caches, key-value and vector stores, ORMs and query builders",
  Authentication: "login, identity providers, SSO, OAuth/OIDC, sessions, permissions",
  "UI Components": "component libraries, CSS frameworks, design systems, charts, animation, UI toolkits",
  "Web Framework": "frameworks and libraries for building web apps and APIs, static site generators, app state",
  "Developer Tools": "editors, terminals, shells, languages, compilers, runtimes, build tools, linters, package managers, git tools, SDKs",
  Testing: "test frameworks and runners, browser and end-to-end testing, mocking, load testing",
  Automation: "workflow automation, bots, browser automation, home automation, task runners",
  Search: "search engines, full-text and vector search libraries",
  Observability: "monitoring, logging, tracing, metrics, product and web analytics, status pages",
  Deployment: "containers, orchestration, CI/CD, infrastructure as code, PaaS, serverless platforms",
  Scraping: "crawlers, scrapers, web data extraction",
  Media: "video, audio, images, PDF, 3D and graphics, game engines, drawing tools, media servers",
  Networking: "HTTP clients and servers, proxies, VPNs, DNS, RPC, realtime messaging, file sync",
  Security: "scanners, penetration testing, secrets, encryption, privacy and ad blocking, password managers",
  "Data Processing": "dataframes, ETL and pipelines, stream processing, BI and analytics apps, notebooks, scientific computing",
};

const PLATFORM_GUIDE: Record<Platform, string> = {
  Web: "used in a browser: web apps, frontend libraries",
  Server: "backend services, self-hosted apps, databases, server frameworks",
  CLI: "primarily used from a terminal",
  iOS: "native iOS/Apple-platform apps and libraries",
  Android: "native Android apps and libraries",
  Desktop: "desktop applications, or frameworks for building them",
  "Browser Extension": "browser extensions",
  Embedded: "microcontrollers, IoT devices, firmware, single-board computers",
  "Cross-platform": "general-purpose libraries, languages, runtimes and toolkits that run in many environments",
};

const NEIGHBORHOOD_GUIDE: Record<ClusterId, string> = {
  ai: "AI / LLM projects",
  data: "Database, Search, Data Processing and Scraping",
  web: "Web Framework and UI Components for the web",
  apps: "native mobile and desktop apps, and the frameworks and libraries for building them (Flutter, React Native, Electron, Tauri, Swift/Kotlin libraries)",
  media: "Media projects",
  devtools: "Developer Tools, Testing, Automation and embedded toolchains",
  infra: "Deployment, Observability and Networking",
  security: "Authentication and Security",
};

/** Generated from the taxonomy so the instructions can't drift from the enums in the schema. */
export const CLASSIFIER_SYSTEM_PROMPT = `You classify open-source GitHub repositories for GitHubble, a map of the GitHub ecosystem where every repository is a star placed in a neighborhood of related projects. Classify each repository by what it primarily is and does, not by every technology it mentions.

problem — the main problem it solves:
${PROBLEM_CATEGORIES.map((p) => `- ${p}: ${PROBLEM_GUIDE[p]}`).join("\n")}

platform — where it runs or what it targets:
${PLATFORMS.map((p) => `- ${p}: ${PLATFORM_GUIDE[p]}`).join("\n")}

neighborhood — the region of the galaxy it belongs in:
${CLUSTERS.map((c) => `- ${c.id} (${c.label}): ${NEIGHBORHOOD_GUIDE[c.id]}`).join("\n")}

software — false for repositories that aren't software you can use: curated lists (awesome-*), books, courses, tutorials, interview preparation, roadmaps, cheat sheets, documentation-only repositories, and collections of prompts, configs or dotfiles. True for libraries, frameworks, applications and tools.

Return exactly one result for every repository id you are given.`;

export type ModelResult = {
  id: number;
  problem: ProblemCategory;
  platform: Platform;
  neighborhood: ClusterId;
  software: boolean;
};

/** The user message for one batch: compact JSON, one entry per repository. */
export function classificationRequest(batch: readonly Candidate[]): string {
  const repositories = batch.map((c, id) => ({
    id,
    repository: c.fullName,
    description: c.description,
    topics: c.topics,
    language: c.language,
  }));
  return `Classify these ${batch.length} repositories:\n${JSON.stringify(repositories)}`;
}

/**
 * Maps a batch's model results back to its candidates by id. Unknown or
 * duplicate ids are ignored; ids the model skipped come back as `missing`.
 */
export function mergeResults(
  batch: readonly Candidate[],
  results: readonly ModelResult[],
  classifiedBy: string,
): { classified: Map<number, Classification>; missing: Candidate[] } {
  const classified = new Map<number, Classification>();
  for (const result of results) {
    const candidate = batch[result.id];
    if (!candidate || classified.has(candidate.githubId)) continue;
    classified.set(candidate.githubId, {
      problemCategory: result.problem,
      platform: result.platform,
      clusterId: result.neighborhood,
      isSoftware: result.software,
      classifiedBy,
    });
  }
  return { classified, missing: batch.filter((c) => !classified.has(c.githubId)) };
}

/** Everything that feeds a classification; a cached result is reused while this is unchanged. */
export function classificationFingerprint(candidate: Candidate, model: string): string {
  return JSON.stringify([
    CLASSIFICATION_VERSION,
    model,
    candidate.fullName,
    candidate.description,
    [...candidate.topics].sort(),
    candidate.language,
  ]);
}
