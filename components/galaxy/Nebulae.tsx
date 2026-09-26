"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { armFrame } from "@/lib/galaxyLayout";
import { createRandom, gaussian } from "@/lib/random";
import { useGalaxyStore } from "@/store/galaxyStore";
import { isLowPowerDevice, revealProgress } from "./sceneEnvironment";
import { nebulaFragmentShader, nebulaVertexShader } from "./shaders";
import { hexToRgb } from "./starBuffers";

type Cloud = { center: [number, number, number]; scale: number; color: string; intensity: number };

const ARM_TINTS = ["#5a4fcf", "#3f5fd0", "#6a4fc0", "#2f69b8", "#8a3f9c"];

/**
 * Soft, camera-facing clouds: the warm glow of the core, violet/blue haze along
 * the arms, and a barely-there tint around each neighborhood so it reads as a
 * region from afar. Instanced quads rather than points, so large clouds are not
 * limited by the device's maximum point size.
 */
export function Nebulae() {
  const clusters = useGalaxyStore((s) => s.dataset.clusters);

  const geometry = useMemo(() => {
    const random = createRandom(7);
    const clouds: Cloud[] = [
      { center: [0, 0, 0], scale: 95, color: "#4c5bd4", intensity: 0.05 },
      { center: [0, 0, 0], scale: 44, color: "#ffc98f", intensity: 0.15 },
      { center: [0, 0, 0], scale: 16, color: "#ffe6c4", intensity: 0.26 },
    ];

    const armClouds = isLowPowerDevice() ? 26 : 48;
    for (let i = 0; i < armClouds; i++) {
      const offset = random() < 0.75 ? (random() < 0.5 ? 0 : Math.PI) : random() < 0.5 ? Math.PI / 2 : (3 * Math.PI) / 2;
      const radius = 20 + random() * 95;
      const frame = armFrame(offset, radius);
      const across = gaussian(random) * 4;
      clouds.push({
        center: [frame.x + frame.normalX * across, gaussian(random) * 1.5, frame.z + frame.normalZ * across],
        scale: 10 + random() * 16,
        color: ARM_TINTS[Math.floor(random() * ARM_TINTS.length)],
        intensity: 0.03 + random() * 0.045,
      });
    }

    for (const cluster of clusters) {
      clouds.push({
        center: [cluster.center.x, cluster.center.y, cluster.center.z],
        scale: cluster.radius * 1.15 + 6,
        color: cluster.color,
        intensity: 0.032,
      });
    }

    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(clouds.flatMap((c) => c.center)), 3));
    g.setAttribute("aScale", new THREE.InstancedBufferAttribute(new Float32Array(clouds.map((c) => c.scale)), 1));
    g.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(clouds.flatMap((c) => hexToRgb(c.color))), 3));
    g.setAttribute("aIntensity", new THREE.InstancedBufferAttribute(new Float32Array(clouds.map((c) => c.intensity)), 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(clouds.map(() => random())), 1));
    g.instanceCount = clouds.length;
    return g;
  }, [clusters]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uReveal: { value: 0 } },
        vertexShader: nebulaVertexShader,
        fragmentShader: nebulaFragmentShader,
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

  useFrame((state) => {
    material.uniforms.uReveal.value = revealProgress(state.clock.elapsedTime);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
