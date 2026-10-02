/** The subset of a GitHub REST "search repositories" item the importer relies on. */
export type GitHubSearchItem = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  disabled?: boolean;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
};

/** A repository the importer may place in the galaxy. */
export type Candidate = {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  githubUrl: string;
  homepageUrl: string | null;
  stars: number;
  forks: number;
  language: string;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
};

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TOPICS = 12;

/** GitHub descriptions often carry emoji shortcodes (":rocket:") that render as text. */
function cleanDescription(description: string): string {
  const text = description
    .replace(/:[a-z0-9_+-]+:/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > MAX_DESCRIPTION_LENGTH ? `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…` : text;
}

function cleanHomepage(homepage: string | null, githubUrl: string): string | null {
  const value = homepage?.trim();
  if (!value) return null;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com" || url.replace(/\/$/, "") === githubUrl) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Null when the repository isn't a candidate (fork, archived, disabled, or no description). */
export function normalizeItem(item: GitHubSearchItem): Candidate | null {
  if (item.fork || item.archived || item.disabled) return null;
  const description = cleanDescription(item.description ?? "");
  if (!description) return null;
  return {
    githubId: item.id,
    owner: item.owner.login,
    name: item.name,
    fullName: item.full_name,
    description,
    githubUrl: item.html_url,
    homepageUrl: cleanHomepage(item.homepage, item.html_url),
    stars: item.stargazers_count,
    forks: item.forks_count,
    language: item.language ?? "Other",
    topics: (item.topics ?? []).slice(0, MAX_TOPICS).map((t) => t.toLowerCase()),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    pushedAt: item.pushed_at,
  };
}
