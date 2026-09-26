"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { computeStarTargets } from "@/lib/visualState";
import { useGalaxyStore } from "@/store/galaxyStore";
import { revealProgress } from "./sceneEnvironment";
import { starFragmentShader, starVertexShader } from "./shaders";
import { getStarBuffers } from "./starBuffers";
import { getStarProjection, projectStars } from "./starProjection";

/** How quickly stars ease towards new emphasis targets (per second). */
const EASE_RATE = 7;

/**
 * Every repository as one THREE.Points draw call. Store changes only rewrite
 * the emphasis targets; the frame loop eases the GPU attributes towards them.
 * No React re-render is involved in hover, selection or filtering.
 */
export function RepositoryStars() {
  const dataset = useGalaxyStore((s) => s.dataset);
  const buffers = useMemo(() => getStarBuffers(dataset), [dataset]);
  const gl = useThree((s) => s.gl);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(buffers.positions, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(buffers.baseSizes, 1));
    g.setAttribute("aMagnitude", new THREE.BufferAttribute(buffers.magnitudes, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(buffers.colors, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(buffers.seeds, 1));
    g.setAttribute("aIndex", new THREE.BufferAttribute(buffers.indices, 1));
    g.setAttribute("aVisibility", new THREE.BufferAttribute(buffers.visibility, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aHighlight", new THREE.BufferAttribute(buffers.highlight, 1).setUsage(THREE.DynamicDrawUsage));
    return g;
  }, [buffers]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uViewportHeight: { value: 1 },
          uMaxPointSize: { value: 256 },
          uReveal: { value: 0 },
          uHovered: { value: -1 },
          uSelected: { value: -1 },
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const context = gl.getContext();
    const range = context.getParameter(context.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
    material.uniforms.uMaxPointSize.value = range?.[1] ?? 256;
  }, [gl, material]);

  const targets = useMemo(
    () => ({ visibility: new Float32Array(buffers.count).fill(1), highlight: new Float32Array(buffers.count) }),
    [buffers],
  );
  const easing = useRef(true);

  useEffect(() => {
    const update = (state: ReturnType<typeof useGalaxyStore.getState>) => {
      const topScore = state.similar[0]?.score ?? 1;
      computeStarTargets(
        {
          filterMask: state.filterMask,
          searchMask: state.searchMask,
          similar:
            state.similarAnchorIndex >= 0 ? new Map(state.similar.map((s) => [s.index, s.score / topScore])) : null,
          anchorIndex: state.similarAnchorIndex,
          selectedIndex: state.selectedIndex,
          clusterIndex: dataset.clusterIndex,
        },
        targets.visibility,
        targets.highlight,
      );
      easing.current = true;
    };
    update(useGalaxyStore.getState());
    return useGalaxyStore.subscribe((state, prev) => {
      if (
        state.filterMask !== prev.filterMask ||
        state.searchMask !== prev.searchMask ||
        state.similar !== prev.similar ||
        state.similarAnchorIndex !== prev.similarAnchorIndex ||
        state.selectedIndex !== prev.selectedIndex
      ) {
        update(state);
      }
    });
  }, [dataset, targets]);

  useFrame((state, delta) => {
    const uniforms = material.uniforms;
    const { hoveredIndex, selectedIndex } = useGalaxyStore.getState();
    const reveal = revealProgress(state.clock.elapsedTime);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uViewportHeight.value = state.size.height;
    uniforms.uReveal.value = reveal;
    uniforms.uHovered.value = hoveredIndex;
    uniforms.uSelected.value = selectedIndex;

    if (easing.current) {
      const k = 1 - Math.exp(-Math.min(delta, 0.1) * EASE_RATE);
      let remaining = 0;
      for (let i = 0; i < buffers.count; i++) {
        const dv = targets.visibility[i] - buffers.visibility[i];
        const dh = targets.highlight[i] - buffers.highlight[i];
        buffers.visibility[i] += dv * k;
        buffers.highlight[i] += dh * k;
        remaining = Math.max(remaining, Math.abs(dv), Math.abs(dh));
      }
      if (remaining < 0.002) {
        buffers.visibility.set(targets.visibility);
        buffers.highlight.set(targets.highlight);
        easing.current = false;
      }
      geometry.attributes.aVisibility.needsUpdate = true;
      geometry.attributes.aHighlight.needsUpdate = true;
    }

    projectStars(
      state.camera as THREE.PerspectiveCamera,
      state.size.width,
      state.size.height,
      buffers,
      getStarProjection(buffers),
      reveal,
    );
  }, -1);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
