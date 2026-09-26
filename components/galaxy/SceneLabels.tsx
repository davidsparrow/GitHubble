"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { displayName, formatCompact } from "@/lib/format";
import { languageColor } from "@/lib/taxonomy";
import type { Repository } from "@/lib/types";
import { useGalaxyStore } from "@/store/galaxyStore";
import { revealProgress } from "./sceneEnvironment";
import { getStarBuffers } from "./starBuffers";
import { getStarProjection } from "./starProjection";

/*
 * Text over the galaxy, written straight to the DOM from the frame loop: a
 * fixed pool of repository labels (assigned each frame to the most prominent
 * stars that fit without overlapping), neighborhood names, and the hover
 * preview. No React renders, and the node count stays constant however many
 * repositories the galaxy holds.
 */

const POOL_SIZE = 36;
/** On-screen sprite diameter (px) an ordinary star needs before it earns a label. */
const MIN_LABEL_SIZE = 17;
const CHAR_WIDTH = 6.6;
/** Fallback width per character of a neighborhood name, before it can be measured. */
const CLUSTER_CHAR_WIDTH = 9.6;
const LABEL_HEIGHT = 13;
const LABEL_GAP = 4;
const HEADER_CLEARANCE = 64;

type Slot = { element: HTMLDivElement; index: number };

type Preview = {
  element: HTMLDivElement;
  owner: HTMLSpanElement;
  name: HTMLSpanElement;
  stars: HTMLSpanElement;
  dot: HTMLElement;
  language: HTMLSpanElement;
  category: HTMLSpanElement;
  description: HTMLDivElement;
  index: number;
  width: number;
  height: number;
};

type Layer = { slots: Slot[]; clusters: HTMLDivElement[]; clusterWidths: number[]; preview: Preview };

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

function createPreview(parent: HTMLElement): Preview {
  const root = element("div", "hover-preview", parent);
  const title = element("div", "truncate font-mono text-[12.5px]", root);
  const owner = element("span", "text-ink-muted", title);
  const name = element("span", "font-semibold text-white", title);
  const meta = element("div", "mt-1 flex items-center gap-2.5 text-[11px] text-ink-muted", root);
  const stars = element("span", "font-medium text-starlight", meta);
  const languageWrap = element("span", "inline-flex items-center gap-1.5", meta);
  const dot = element("i", "inline-block size-2 rounded-full", languageWrap);
  const language = element("span", "", languageWrap);
  const category = element("span", "truncate", meta);
  const description = element("div", "mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-ink/70", root);
  return { element: root, owner, name, stars, dot, language, category, description, index: -1, width: 0, height: 0 };
}

function fillPreview(preview: Preview, repo: Repository) {
  preview.owner.textContent = `${repo.owner}/`;
  preview.name.textContent = repo.name;
  preview.stars.textContent = `★ ${formatCompact(repo.stars)}`;
  preview.dot.style.backgroundColor = languageColor(repo.language);
  preview.language.textContent = repo.language;
  preview.category.textContent = repo.problemCategory;
  preview.description.textContent = repo.description;
  preview.width = preview.element.offsetWidth;
  preview.height = preview.element.offsetHeight;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const scratch = new THREE.Vector3();

/** Does the rectangle collide with any placed rectangle (flattened x0, y0, x1, y1 quadruples)? */
function overlapsPlaced(placed: number[], x0: number, y0: number, x1: number, y1: number): boolean {
  for (let p = 0; p < placed.length; p += 4) {
    if (x0 < placed[p + 2] + LABEL_GAP && x1 + LABEL_GAP > placed[p] && y0 < placed[p + 3] + LABEL_GAP && y1 + LABEL_GAP > placed[p + 1]) {
      return true;
    }
  }
  return false;
}

export function SceneLabels() {
  const gl = useThree((s) => s.gl);
  const dataset = useGalaxyStore((s) => s.dataset);
  const buffers = useMemo(() => getStarBuffers(dataset), [dataset]);
  const layer = useRef<Layer | null>(null);
  const clusterOrder = useMemo(
    () => dataset.clusters.map((_, c) => c).sort((a, b) => dataset.clusters[b].count - dataset.clusters[a].count),
    [dataset],
  );

  const work = useMemo(
    () => ({
      alpha: new Float32Array(buffers.count),
      wanted: new Uint8Array(buffers.count),
      slotOf: new Int16Array(buffers.count).fill(-1),
      priority: new Float32Array(buffers.count),
      candidates: [] as number[],
      placed: [] as number[],
      textWidth: Float32Array.from(dataset.repositories, (r) => displayName(r).length * CHAR_WIDTH + 2),
      clusterAlpha: new Float32Array(dataset.clusters.length),
    }),
    [buffers, dataset],
  );

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const root = element("div", "scene-overlay", host);
    const slots = Array.from({ length: POOL_SIZE }, () => {
      const node = element("div", "scene-label", root);
      node.style.opacity = "0";
      return { element: node, index: -1 };
    });
    const clusters = dataset.clusters.map((cluster) => {
      const node = element("div", "cluster-label", root);
      node.textContent = cluster.label;
      node.style.opacity = "0";
      return node;
    });
    const current: Layer = { slots, clusters, clusterWidths: clusters.map(() => 0), preview: createPreview(root) };
    // Measure neighborhood names once the webfont has loaded (their size varies by breakpoint).
    const measure = () => clusters.forEach((node, c) => (current.clusterWidths[c] = node.offsetWidth));
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    layer.current = current;
    work.slotOf.fill(-1);
    work.alpha.fill(0);
    return () => {
      window.removeEventListener("resize", measure);
      root.remove();
      layer.current = null;
    };
  }, [gl, dataset, work]);

  useFrame((frame, delta) => {
    const current = layer.current;
    if (!current) return;
    const { width, height } = frame.size;
    const projection = getStarProjection(buffers);
    const { selectedIndex, hoveredIndex, similarAnchorIndex, searchMask } = useGalaxyStore.getState();
    const { alpha, wanted, slotOf, priority, candidates, placed, textWidth } = work;
    const fade = 1 - Math.exp(-Math.min(delta, 0.1) * 9);
    // The selected star's label steps outside its reticle (ring + ticks, see ringVertexShader).
    const labelX = (i: number) =>
      projection.x[i] + (i === selectedIndex ? projection.size[i] * 0.39 + 26 : projection.size[i] * 0.22 + 7);
    const labelY = (i: number) => projection.y[i] - LABEL_HEIGHT / 2;

    // 1. Candidates: prominent on screen, emphasized, or selected.
    candidates.length = 0;
    for (let i = 0; i < buffers.count; i++) {
      if (!projection.onScreen[i] || buffers.visibility[i] < 0.3) continue;
      if (i === hoveredIndex && i !== selectedIndex) continue;
      const emphasis = buffers.highlight[i];
      if (i !== selectedIndex && emphasis < 0.3 && projection.size[i] < MIN_LABEL_SIZE) continue;
      priority[i] =
        projection.size[i] * buffers.visibility[i] +
        emphasis * 40 +
        (i === selectedIndex ? 10_000 : 0) +
        (alpha[i] > 0.5 ? 12 : 0); // hysteresis: visible labels hold their place
      candidates.push(i);
    }
    candidates.sort((a, b) => priority[b] - priority[a]);

    // 2. Neighborhood names guide you from afar and step aside up close. They're
    //    laid out first (largest neighborhoods win overlaps) and reserve their space.
    placed.length = 0;
    const reveal = revealProgress(frame.clock.elapsedTime);
    const context = similarAnchorIndex >= 0 ? 0.2 : searchMask ? 0.55 : 1;
    for (const c of clusterOrder) {
      const cluster = dataset.clusters[c];
      const node = current.clusters[c];
      scratch.set(cluster.labelAnchor.x, cluster.labelAnchor.y, cluster.labelAnchor.z);
      const distance = frame.camera.position.distanceTo(scratch);
      scratch.project(frame.camera);
      const x = ((scratch.x + 1) / 2) * width;
      const y = ((1 - scratch.y) / 2) * height;
      const halfWidth = (current.clusterWidths[c] || cluster.label.length * CLUSTER_CHAR_WIDTH) / 2;
      const inView = scratch.z < 1 && x - halfWidth > 4 && x + halfWidth < width - 4 && y > HEADER_CLEARANCE && y < height - 8;
      const clear = !overlapsPlaced(placed, x - halfWidth, y - 7, x + halfWidth, y + 7);
      const target = inView && clear ? smoothstep(45, 95, distance) * context * smoothstep(0.55, 1, reveal) : 0;
      work.clusterAlpha[c] += (target - work.clusterAlpha[c]) * fade;
      node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      node.style.opacity = work.clusterAlpha[c].toFixed(3);
      if (target > 0) placed.push(x - halfWidth, y - 7, x + halfWidth, y + 7);
    }

    // The selection reticle is off limits to other labels.
    if (selectedIndex >= 0 && projection.onScreen[selectedIndex]) {
      const reach = projection.size[selectedIndex] * 0.39 + 22;
      const x = projection.x[selectedIndex];
      const y = projection.y[selectedIndex];
      placed.push(x - reach, y - reach, x + reach, y + reach);
    }

    // 3. Star labels: greedy placement without overlaps.
    wanted.fill(0);
    let accepted = 0;
    for (const i of candidates) {
      if (accepted >= POOL_SIZE) break;
      const x0 = labelX(i);
      const y0 = labelY(i);
      const x1 = x0 + textWidth[i];
      const y1 = y0 + LABEL_HEIGHT;
      if (x1 > width - 4 || y0 < HEADER_CLEARANCE || y1 > height - 4) continue;
      if (overlapsPlaced(placed, x0, y0, x1, y1)) continue;
      placed.push(x0, y0, x1, y1);
      wanted[i] = 1;
      accepted++;
    }

    // 4. Fade out and release labels that lost their place; hand free slots to newcomers.
    for (const slot of current.slots) {
      if (slot.index < 0) continue;
      const i = slot.index;
      alpha[i] += ((wanted[i] ? 1 : 0) - alpha[i]) * fade;
      if (!wanted[i] && alpha[i] < 0.02) {
        alpha[i] = 0;
        slotOf[i] = -1;
        slot.index = -1;
        slot.element.style.opacity = "0";
      }
    }
    for (const i of candidates) {
      if (!wanted[i] || slotOf[i] >= 0) continue;
      const free = current.slots.findIndex((slot) => slot.index < 0);
      if (free < 0) break;
      const slot = current.slots[free];
      slot.index = i;
      slot.element.textContent = displayName(dataset.repositories[i]);
      slotOf[i] = free;
      alpha[i] = 0;
    }

    // 5. Position.
    for (const slot of current.slots) {
      if (slot.index < 0) continue;
      const i = slot.index;
      slot.element.style.transform = `translate3d(${labelX(i).toFixed(1)}px, ${labelY(i).toFixed(1)}px, 0)`;
      slot.element.style.opacity = projection.onScreen[i] ? (alpha[i] * (0.5 + 0.5 * buffers.visibility[i])).toFixed(3) : "0";
      const emphasis = i === selectedIndex ? "selected" : buffers.highlight[i] > 0.3 ? "highlight" : "";
      if (slot.element.dataset.emphasis !== emphasis) slot.element.dataset.emphasis = emphasis;
    }

    // 6. Hover preview, pinned beside the hovered star (flipping left near the edge).
    const preview = current.preview;
    const hovered = hoveredIndex >= 0 && hoveredIndex !== selectedIndex && projection.onScreen[hoveredIndex] ? hoveredIndex : -1;
    if (hovered !== preview.index) {
      preview.index = hovered;
      if (hovered >= 0) fillPreview(preview, dataset.repositories[hovered]);
      preview.element.style.opacity = hovered >= 0 ? "1" : "0";
    }
    if (hovered >= 0) {
      const reach = projection.size[hovered] * 0.25 + 14;
      let x = projection.x[hovered] + reach;
      if (x + preview.width > width - 12) x = projection.x[hovered] - reach - preview.width;
      const y = Math.min(Math.max(projection.y[hovered] - 22, HEADER_CLEARANCE), height - preview.height - 12);
      preview.element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  });

  return null;
}
