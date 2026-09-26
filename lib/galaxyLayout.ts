import { createRandom, gaussian, hashString } from "./random";
import { starMagnitude } from "./starScale";
import { CLUSTERS, CLUSTER_BY_ID, type ClusterId } from "./taxonomy";
import type { Repository, Vec3 } from "./types";

/**
 * Spiral-galaxy geometry. Repositories are laid out once (at seed/import time)
 * and the coordinates persisted; the browser never runs layout physics.
 *
 * Neighborhoods (clusters) sit end to end along two logarithmic spiral arms,
 * related neighborhoods adjacent to each other. Inside a neighborhood,
 * repositories are grouped by problem category, then ordered by their most
 * widely shared topic so that similar projects end up physically adjacent.
 */

export const ARM_OFFSETS = [0, Math.PI] as const;
export const ARM_INNER_RADIUS = 16;
export const ARM_OUTER_RADIUS = 100;
/** Tangent of the spiral's pitch angle; smaller values wind the arms tighter. */
export const ARM_PITCH = 0.42;

const CLUSTER_GAP = 4.5;
const RELAX_ITERATIONS = 40;

/** Polar angle of the spiral arm starting at `offset`, at `radius` from the core. */
export function armAngle(offset: number, radius: number): number {
  return offset + Math.log(Math.max(radius, 1) / ARM_INNER_RADIUS) / ARM_PITCH;
}

export type ArmFrame = {
  x: number;
  z: number;
  /** Unit vector along the arm, pointing outwards. */
  tangentX: number;
  tangentZ: number;
  /** In-plane unit vector across the arm, pointing away from the core. */
  normalX: number;
  normalZ: number;
};

export function armFrame(offset: number, radius: number): ArmFrame {
  const theta = armAngle(offset, radius);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // d/dr of (r·cosθ, r·sinθ), with dθ/dr = 1 / (pitch · r)
  let tangentX = cos - sin / ARM_PITCH;
  let tangentZ = sin + cos / ARM_PITCH;
  const length = Math.hypot(tangentX, tangentZ);
  tangentX /= length;
  tangentZ /= length;
  let normalX = -tangentZ;
  let normalZ = tangentX;
  if (normalX * cos + normalZ * sin < 0) {
    normalX = -normalX;
    normalZ = -normalZ;
  }
  return { x: radius * cos, z: radius * sin, tangentX, tangentZ, normalX, normalZ };
}

/** Vertical spread of the disc at `radius`: puffier towards the core. */
export function discThickness(radius: number): number {
  return 1.8 + 5.5 * Math.exp(-radius / 30);
}

/** Gentle warp so the disc isn't perfectly flat. */
export function discWarp(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  return 0.045 * radius * Math.sin(Math.atan2(z, x) - 0.8) * Math.min(1, radius / 60);
}

export type LayoutItem = Pick<Repository, "id" | "stars" | "clusterId" | "problemCategory" | "language" | "topics">;

/** Computes deterministic galaxy coordinates for `items` (returned in the same order). */
export function layoutGalaxy(items: readonly LayoutItem[]): Vec3[] {
  const positions: Vec3[] = items.map(() => ({ x: 0, y: 0, z: 0 }));
  const members = new Map<ClusterId, number[]>();
  items.forEach((item, i) => {
    const list = members.get(item.clusterId);
    if (list) list.push(i);
    else members.set(item.clusterId, [i]);
  });

  for (const arm of [0, 1] as const) {
    const clusters = CLUSTERS.filter((c) => c.arm === arm && members.has(c.id)).sort((a, b) => a.order - b.order);
    if (clusters.length === 0) continue;
    // Arc length grows linearly with radius on a log spiral, so a √count share
    // keeps big neighborhoods from monopolising the arm.
    const weights = clusters.map((c) => Math.sqrt(members.get(c.id)!.length));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const available = ARM_OUTER_RADIUS - ARM_INNER_RADIUS - CLUSTER_GAP * (clusters.length - 1);
    let start = ARM_INNER_RADIUS;
    clusters.forEach((cluster, k) => {
      const length = (available * weights[k]) / totalWeight;
      placeCluster(items, members.get(cluster.id)!, ARM_OFFSETS[arm], start, start + length, positions);
      start += length + CLUSTER_GAP;
    });
  }

  return positions;
}

function placeCluster(
  items: readonly LayoutItem[],
  indices: number[],
  armOffset: number,
  start: number,
  end: number,
  positions: Vec3[],
) {
  const groups = new Map<string, number[]>();
  for (const i of indices) {
    const list = groups.get(items[i].problemCategory);
    if (list) list.push(i);
    else groups.set(items[i].problemCategory, [i]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const spread = 2.6 + Math.sqrt(indices.length) * 0.45;

  let cursor = start;
  ordered.forEach(([, group], g) => {
    const length = ((end - start) * group.length) / indices.length;
    const side = ordered.length === 1 ? 0 : (g % 2 === 0 ? 1 : -1) * spread * 0.45;
    const slot = length / group.length;

    sortByAffinity(items, group).forEach((i, rank) => {
      const item = items[i];
      const random = createRandom(hashString(item.id));
      // Bright stars sit closer to the heart of their neighborhood.
      const tightness = 0.55 + 0.45 * (1 - starMagnitude(item.stars));
      const radius = cursor + (rank + 0.5) * slot + gaussian(random) * Math.max(0.8, slot * 0.9);
      const frame = armFrame(armOffset, radius);
      const across = side + gaussian(random) * spread * 0.55 * tightness;
      const x = frame.x + frame.normalX * across;
      const z = frame.z + frame.normalZ * across;
      const y = gaussian(random) * discThickness(radius) * (0.5 + 0.5 * tightness) + discWarp(x, z);
      positions[i] = { x, y, z };
    });

    cursor += length;
  });

  relax(items, indices, positions);
}

/**
 * Orders a category group so repositories sharing their most common topic (or,
 * failing that, their language) are adjacent. Popular repositories lead each run.
 */
function sortByAffinity(items: readonly LayoutItem[], group: number[]): number[] {
  const topicCounts = new Map<string, number>();
  for (const i of group) for (const topic of items[i].topics) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);

  const affinityKey = (i: number) => {
    let best = "";
    let bestCount = 1;
    for (const topic of items[i].topics) {
      const count = topicCounts.get(topic) ?? 0;
      if (count > bestCount || (count === bestCount && count > 1 && topic < best)) {
        best = topic;
        bestCount = count;
      }
    }
    return best ? `t:${best}` : `l:${items[i].language}`;
  };

  const keys = new Map(group.map((i) => [i, affinityKey(i)]));
  return [...group].sort(
    (a, b) => keys.get(a)!.localeCompare(keys.get(b)!) || items[b].stars - items[a].stars || items[a].id.localeCompare(items[b].id),
  );
}

/**
 * Pushes overlapping stars apart; larger stars claim more personal space.
 * Neighbors are found through a planar grid (the disc is thin), so each pass
 * is ~O(n) rather than O(n²) and large imports stay fast.
 */
function relax(items: readonly LayoutItem[], indices: number[], positions: Vec3[]) {
  const personalSpace = indices.map((i) => 0.9 + 1.4 * starMagnitude(items[i].stars));
  const cellSize = 2 * Math.max(...personalSpace);
  const cellKey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
  const grid = new Map<number, number[]>();

  for (let iteration = 0; iteration < RELAX_ITERATIONS; iteration++) {
    grid.clear();
    indices.forEach((i, a) => {
      const key = cellKey(Math.floor(positions[i].x / cellSize), Math.floor(positions[i].z / cellSize));
      const bucket = grid.get(key);
      if (bucket) bucket.push(a);
      else grid.set(key, [a]);
    });

    let moved = false;
    for (let a = 0; a < indices.length; a++) {
      const pa = positions[indices[a]];
      const cx = Math.floor(pa.x / cellSize);
      const cz = Math.floor(pa.z / cellSize);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const bucket = grid.get(cellKey(cx + ox, cz + oz));
          if (!bucket) continue;
          for (const b of bucket) {
            if (b <= a) continue;
            const pb = positions[indices[b]];
            let dx = pb.x - pa.x;
            let dy = pb.y - pa.y;
            let dz = pb.z - pa.z;
            let distance = Math.hypot(dx, dy, dz);
            const minimum = personalSpace[a] + personalSpace[b];
            if (distance >= minimum) continue;
            if (distance < 1e-6) {
              dx = 0.01 * (b - a);
              dy = 0;
              dz = 0.01;
              distance = Math.hypot(dx, dz);
            }
            const push = (minimum - distance) / (2 * distance);
            pa.x -= dx * push;
            pa.y -= dy * push * 0.3;
            pa.z -= dz * push;
            pb.x += dx * push;
            pb.y += dy * push * 0.3;
            pb.z += dz * push;
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }
}

export type ClusterSummary = {
  id: ClusterId;
  label: string;
  color: string;
  count: number;
  center: Vec3;
  /** Where the neighborhood's floating label sits: just outside the cluster, away from the core. */
  labelAnchor: Vec3;
  /** Distance from the center that contains ~90% of the members. */
  radius: number;
};

export function summarizeClusters(repositories: readonly Repository[]): ClusterSummary[] {
  const summaries: ClusterSummary[] = [];
  for (const definition of CLUSTERS) {
    const members = repositories.filter((r) => r.clusterId === definition.id);
    if (members.length === 0) continue;
    const center = {
      x: mean(members.map((r) => r.x)),
      y: mean(members.map((r) => r.y)),
      z: mean(members.map((r) => r.z)),
    };
    const distances = members.map((r) => Math.hypot(r.x - center.x, r.y - center.y, r.z - center.z)).sort((a, b) => a - b);
    const radius = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.9))];
    const planar = Math.hypot(center.x, center.z) || 1;
    const offset = radius * 0.55 + 5;
    summaries.push({
      id: definition.id,
      label: CLUSTER_BY_ID[definition.id].label,
      color: definition.color,
      count: members.length,
      center,
      labelAnchor: {
        x: center.x + (center.x / planar) * offset,
        y: center.y + 3,
        z: center.z + (center.z / planar) * offset,
      },
      radius,
    });
  }
  return summaries;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
