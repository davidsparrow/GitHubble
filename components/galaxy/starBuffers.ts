import type { GalaxyDataset } from "@/lib/repositoryData";
import { hashString } from "@/lib/random";
import { starBaseSize, starMagnitude } from "@/lib/starScale";
import { CLUSTER_BY_ID } from "@/lib/taxonomy";

/**
 * Flat typed arrays describing every repository star. One set per dataset,
 * shared by the renderer (as GPU attributes), CPU picking and scene labels.
 */
export type StarBuffers = {
  count: number;
  positions: Float32Array;
  baseSizes: Float32Array;
  magnitudes: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  indices: Float32Array;
  /** Current, animated emphasis. Written by RepositoryStars every frame while easing. */
  visibility: Float32Array;
  highlight: Float32Array;
};

const cache = new WeakMap<GalaxyDataset, StarBuffers>();

/** Parses "#rrggbb" into sRGB floats (no color-management conversion: shaders write sRGB directly). */
export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function getStarBuffers(dataset: GalaxyDataset): StarBuffers {
  const cached = cache.get(dataset);
  if (cached) return cached;

  const { repositories } = dataset;
  const count = repositories.length;
  const buffers: StarBuffers = {
    count,
    positions: new Float32Array(count * 3),
    baseSizes: new Float32Array(count),
    magnitudes: new Float32Array(count),
    colors: new Float32Array(count * 3),
    seeds: new Float32Array(count),
    indices: new Float32Array(count),
    visibility: new Float32Array(count).fill(1),
    highlight: new Float32Array(count),
  };

  repositories.forEach((repo, i) => {
    buffers.positions.set([repo.x, repo.y, repo.z], i * 3);
    buffers.baseSizes[i] = starBaseSize(repo.stars);
    buffers.magnitudes[i] = starMagnitude(repo.stars);
    buffers.colors.set(hexToRgb(CLUSTER_BY_ID[repo.clusterId].color), i * 3);
    buffers.seeds[i] = (hashString(repo.id) % 10_000) / 10_000;
    buffers.indices[i] = i;
  });

  cache.set(dataset, buffers);
  return buffers;
}
