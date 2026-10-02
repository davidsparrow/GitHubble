import type { ClusterId, Platform, ProblemCategory } from "../taxonomy";
import type { Repository, Vec3 } from "../types";
import type { Candidate } from "./candidate";
import type { Classification } from "./classification";

/** A row of `public.repositories` (see supabase/migrations). */
export type RepositoryRow = {
  github_id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string;
  github_url: string;
  homepage_url: string | null;
  stars: number;
  forks: number;
  primary_language: string;
  topics: string[];
  problem_category: ProblemCategory;
  platform_category: Platform;
  cluster_id: ClusterId;
  is_software: boolean;
  classification_model: string;
  in_galaxy: boolean;
  x: number;
  y: number;
  z: number;
  created_at_github: string;
  updated_at_github: string;
  pushed_at: string;
  indexed_at: string;
};

/** The columns the app reads back. */
export const GALAXY_COLUMNS =
  "owner,name,description,stars,primary_language,topics,problem_category,platform_category,cluster_id,x,y,z,pushed_at,homepage_url,indexed_at";

export type GalaxyRow = Pick<
  RepositoryRow,
  | "owner"
  | "name"
  | "description"
  | "stars"
  | "primary_language"
  | "topics"
  | "problem_category"
  | "platform_category"
  | "cluster_id"
  | "x"
  | "y"
  | "z"
  | "pushed_at"
  | "homepage_url"
  | "indexed_at"
>;

/** The unplaced repository a candidate becomes once classified (the layout adds coordinates). */
export function toRepository(candidate: Candidate, classification: Classification): Repository {
  return {
    id: candidate.fullName,
    owner: candidate.owner,
    name: candidate.name,
    description: candidate.description,
    stars: candidate.stars,
    language: candidate.language,
    topics: candidate.topics,
    problemCategory: classification.problemCategory,
    platform: classification.platform,
    clusterId: classification.clusterId,
    x: 0,
    y: 0,
    z: 0,
    githubUrl: candidate.githubUrl,
    updatedAt: candidate.pushedAt,
    ...(candidate.homepageUrl ? { homepageUrl: candidate.homepageUrl } : {}),
  };
}

export function toRow(
  candidate: Candidate,
  classification: Classification,
  position: Vec3 | null,
  indexedAt: string,
): RepositoryRow {
  return {
    github_id: candidate.githubId,
    owner: candidate.owner,
    name: candidate.name,
    full_name: candidate.fullName,
    description: candidate.description,
    github_url: candidate.githubUrl,
    homepage_url: candidate.homepageUrl,
    stars: candidate.stars,
    forks: candidate.forks,
    primary_language: candidate.language,
    topics: candidate.topics,
    problem_category: classification.problemCategory,
    platform_category: classification.platform,
    cluster_id: classification.clusterId,
    is_software: classification.isSoftware,
    classification_model: classification.classifiedBy,
    in_galaxy: position !== null,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    z: position?.z ?? 0,
    created_at_github: candidate.createdAt,
    updated_at_github: candidate.updatedAt,
    pushed_at: candidate.pushedAt,
    indexed_at: indexedAt,
  };
}

export function fromGalaxyRow(row: GalaxyRow): Repository {
  return {
    id: `${row.owner}/${row.name}`,
    owner: row.owner,
    name: row.name,
    description: row.description,
    stars: row.stars,
    language: row.primary_language,
    topics: row.topics,
    problemCategory: row.problem_category,
    platform: row.platform_category,
    clusterId: row.cluster_id,
    x: row.x,
    y: row.y,
    z: row.z,
    githubUrl: `https://github.com/${row.owner}/${row.name}`,
    updatedAt: row.pushed_at,
    ...(row.homepage_url ? { homepageUrl: row.homepage_url } : {}),
  };
}
