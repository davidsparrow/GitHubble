"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGalaxyStore } from "@/store/galaxyStore";
import { prefersReducedMotion } from "./sceneEnvironment";
import { ringFragmentShader, ringVertexShader } from "./shaders";
import { getStarBuffers } from "./starBuffers";

/** A thin, slowly turning telescope reticle around the selected repository. */
export function SelectionReticle() {
  const dataset = useGalaxyStore((s) => s.dataset);
  const buffers = useMemo(() => getStarBuffers(dataset), [dataset]);
  const points = useRef<THREE.Points>(null);
  const shown = useRef({ index: -1, appear: 0 });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array([1]), 1));
    g.setAttribute("aStrength", new THREE.BufferAttribute(new Float32Array([1]), 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: 1 },
          uViewportHeight: { value: 1 },
          uAppear: { value: 0 },
          uPadding: { value: 13 },
          uTime: { value: 0 },
          uTicks: { value: 1 },
          uColor: { value: new THREE.Vector3(0.9, 0.93, 1) },
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

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state, delta) => {
    const selected = useGalaxyStore.getState().selectedIndex;
    const current = shown.current;
    if (selected !== current.index) {
      current.index = selected;
      current.appear = 0;
      if (selected >= 0) {
        geometry.attributes.position.array.set(buffers.positions.subarray(selected * 3, selected * 3 + 3));
        (geometry.attributes.aSize.array as Float32Array)[0] = buffers.baseSizes[selected] * 1.3;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.aSize.needsUpdate = true;
      }
    }
    current.appear = prefersReducedMotion() ? 1 : Math.min(1, current.appear + delta / 0.35);
    if (points.current) points.current.visible = selected >= 0;

    const uniforms = material.uniforms;
    uniforms.uAppear.value = 1 - Math.pow(1 - current.appear, 3);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uViewportHeight.value = state.size.height;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} visible={false} />;
}
