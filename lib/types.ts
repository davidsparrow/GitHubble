import type { ClusterId, Platform, ProblemCategory } from "./taxonomy";

export type Repository = {
  /** Stable identifier: `owner/name` for the sample universe, the GitHub node id later. */
  id: string;
  owner: string;
  name: string;
  description: string;
  stars: number;
  language: string;
  topics: string[];
  problemCategory: ProblemCategory;
  platform: Platform;
  /** Galactic coordinates: x/z span the disc, y is the height above the plane. */
  x: number;
  y: number;
  z: number;
  clusterId: ClusterId;
  githubUrl: string;
  /** ISO-8601 timestamp of the last update on GitHub. */
  updatedAt: string;
};

export type ViewMode = "telescope" | "above";

export type Vec3 = { x: number; y: number; z: number };
