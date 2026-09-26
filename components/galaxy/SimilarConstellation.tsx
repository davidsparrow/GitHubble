"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGalaxyStore } from "@/store/galaxyStore";
import { prefersReducedMotion } from "./sceneEnvironment";
import { lineFragmentShader, lineVertexShader, ringFragmentShader, ringVertexShader } from "./shaders";
import { getStarBuffers } from "./starBuffers";

const LINE_COLOR = new THREE.Vector3(0.78, 0.83, 1);

/**
 * Show Similar as a constellation: faint lines drawn outwards from the anchor
 * to each neighbor (stronger matches brighter), plus a thin ring on each neighbor.
 */
export function SimilarConstellation() {
  const dataset = useGalaxyStore((s) => s.dataset);
  const anchor = useGalaxyStore((s) => s.similarAnchorIndex);
  const similar = useGalaxyStore((s) => s.similar);
  const buffers = useMemo(() => getStarBuffers(dataset), [dataset]);
  const progress = useRef(0);

  const { lines, rings } = useMemo(() => {
    const lineGeometry = new THREE.BufferGeometry();
    const ringGeometry = new THREE.BufferGeometry();
    if (anchor < 0 || similar.length === 0) return { lines: lineGeometry, rings: ringGeometry };

    const top = similar[0].score;
    const at = (i: number) => Array.from(buffers.positions.subarray(i * 3, i * 3 + 3));
    const strengths = similar.map((s) => 0.45 + 0.55 * (s.score / top));

    lineGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(similar.flatMap((s) => [...at(anchor), ...at(s.index)])), 3));
    lineGeometry.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(similar.flatMap(() => [0, 1])), 1));
    lineGeometry.setAttribute("aStrength", new THREE.BufferAttribute(new Float32Array(strengths.flatMap((s) => [s, s])), 1));

    ringGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(similar.flatMap((s) => at(s.index))), 3));
    ringGeometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(similar.map((s) => buffers.baseSizes[s.index] * 1.15)), 1));
    ringGeometry.setAttribute("aStrength", new THREE.BufferAttribute(new Float32Array(strengths.map((s) => s * 0.6)), 1));
    return { lines: lineGeometry, rings: ringGeometry };
  }, [anchor, similar, buffers]);

  useEffect(() => {
    progress.current = 0;
    return () => {
      lines.dispose();
      rings.dispose();
    };
  }, [lines, rings]);

  const lineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uProgress: { value: 0 }, uColor: { value: LINE_COLOR } },
        vertexShader: lineVertexShader,
        fragmentShader: lineFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      }),
    [],
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: 1 },
          uViewportHeight: { value: 1 },
          uAppear: { value: 0 },
          uPadding: { value: 7 },
          uTime: { value: 0 },
          uTicks: { value: 0 },
          uColor: { value: LINE_COLOR },
        },
        vertexShader: ringVertexShader,
        fragmentShader: ringFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      }),
    [],
  );

  useEffect(
    () => () => {
      lineMaterial.dispose();
      ringMaterial.dispose();
    },
    [lineMaterial, ringMaterial],
  );

  useFrame((state, delta) => {
    progress.current = prefersReducedMotion() ? 1 : Math.min(1, progress.current + delta / 0.9);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    lineMaterial.uniforms.uProgress.value = eased;
    ringMaterial.uniforms.uAppear.value = Math.max(0, eased * 1.4 - 0.4);
    ringMaterial.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    ringMaterial.uniforms.uViewportHeight.value = state.size.height;
  });

  if (anchor < 0 || similar.length === 0) return null;

  return (
    <>
      <lineSegments geometry={lines} material={lineMaterial} frustumCulled={false} />
      <points geometry={rings} material={ringMaterial} frustumCulled={false} />
    </>
  );
}
