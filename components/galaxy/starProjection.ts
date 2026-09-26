import * as THREE from "three";
import { zoomSizeScale } from "@/lib/starScale";
import { INTERACTIVE_VISIBILITY } from "@/lib/visualState";
import type { StarBuffers } from "./starBuffers";

/**
 * Screen-space positions of every repository star (CSS pixels), refreshed once
 * per frame after the camera moves. Picking and labels read from here instead of
 * raycasting, which stays cheap well into the tens of thousands of stars.
 */
export type StarProjection = {
  x: Float32Array;
  y: Float32Array;
  /** Rendered sprite diameter in CSS px (halo included). */
  size: Float32Array;
  /** 1 when in front of the camera, near the viewport and already revealed. */
  onScreen: Uint8Array;
};

const cache = new WeakMap<StarBuffers, StarProjection>();

export function getStarProjection(buffers: StarBuffers): StarProjection {
  let projection = cache.get(buffers);
  if (!projection) {
    projection = {
      x: new Float32Array(buffers.count),
      y: new Float32Array(buffers.count),
      size: new Float32Array(buffers.count),
      onScreen: new Uint8Array(buffers.count),
    };
    cache.set(buffers, projection);
  }
  return projection;
}

const viewProjection = new THREE.Matrix4();

/** Mirrors the vertex shader's reveal ripple so nothing is pickable before it appears. */
function revealed(x: number, z: number, reveal: number): boolean {
  if (reveal >= 1) return true;
  const radial = Math.min(1, Math.hypot(x, z) / 110);
  return reveal > radial * 0.75 + 0.125;
}

export function projectStars(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  buffers: StarBuffers,
  projection: StarProjection,
  reveal: number,
): void {
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const e = viewProjection.elements;
  const p11 = camera.projectionMatrix.elements[5];
  const { positions, baseSizes, visibility } = buffers;

  for (let i = 0; i < buffers.count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w <= 0.05 || !revealed(x, z, reveal)) {
      projection.onScreen[i] = 0;
      continue;
    }
    const cx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
    const cy = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
    projection.x[i] = (cx + 1) * 0.5 * width;
    projection.y[i] = (1 - cy) * 0.5 * height;
    projection.size[i] = baseSizes[i] * zoomSizeScale((p11 * 0.5 * height) / w) * (0.55 + 0.45 * visibility[i]);
    projection.onScreen[i] = cx > -1.15 && cx < 1.15 && cy > -1.15 && cy < 1.15 ? 1 : 0;
  }
}

/**
 * The star under (x, y), or -1. Within reach, brighter and less-dimmed stars
 * win, so a giant isn't hidden behind a faint neighbor.
 */
export function pickStar(projection: StarProjection, buffers: StarBuffers, x: number, y: number, minReach: number): number {
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < buffers.count; i++) {
    if (!projection.onScreen[i] || buffers.visibility[i] < INTERACTIVE_VISIBILITY) continue;
    const dx = projection.x[i] - x;
    const dy = projection.y[i] - y;
    const reach = Math.max(projection.size[i] * 0.28, minReach);
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > reach * reach) continue;
    const score = Math.sqrt(distanceSquared) / reach - 0.35 * buffers.magnitudes[i] - 0.25 * buffers.visibility[i];
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
