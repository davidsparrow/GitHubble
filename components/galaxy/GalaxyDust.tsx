"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ARM_INNER_RADIUS, armFrame, discThickness, discWarp } from "@/lib/galaxyLayout";
import { createRandom, gaussian } from "@/lib/random";
import { isLowPowerDevice, revealProgress } from "./sceneEnvironment";
import { dustFragmentShader, dustVertexShader } from "./shaders";
import { hexToRgb } from "./starBuffers";

const BULGE = ["#ffd9a8", "#ffe7c8", "#ffcf96"].map(hexToRgb);
const ARM = ["#b9c8ff", "#a3b4ff", "#d7defc", "#c6ccff"].map(hexToRgb);
const HII = hexToRgb("#ff94cb");
const VIOLET = hexToRgb("#9d89ff");
const HAZE = hexToRgb("#8a98d0");

/** Main arms carry the repository neighborhoods; the minor arms are decoration. */
const MAIN_ARMS = [0, Math.PI];
const MINOR_ARMS = [Math.PI / 2, (3 * Math.PI) / 2];

/**
 * Thousands of tiny, dim, non-interactive points that give the galaxy its
 * shape: a warm bulge, blue-white spiral arms and a faint disc haze. Kept
 * deliberately small and faint so repository stars read as the foreground.
 */
export function GalaxyDust() {
  const geometry = useMemo(() => {
    const count = isLowPowerDevice() ? 7000 : 14000;
    const random = createRandom(20260926);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const roll = random();
      let x: number;
      let y: number;
      let z: number;
      let color: [number, number, number];
      let glow = 0.16 + Math.pow(random(), 2.2) * 0.6;

      if (roll < 0.14) {
        // Bulge: a flattened ball of old, warm stars.
        const radius = Math.abs(gaussian(random)) * 9 + random() * 4;
        const theta = random() * Math.PI * 2;
        const phi = Math.acos(2 * random() - 1);
        x = radius * Math.sin(phi) * Math.cos(theta);
        z = radius * Math.sin(phi) * Math.sin(theta);
        y = radius * Math.cos(phi) * 0.55;
        color = BULGE[Math.floor(random() * BULGE.length)];
        glow += 0.12;
      } else if (roll < 0.3) {
        // Disc haze between the arms.
        const radius = Math.min(135, -Math.log(1 - random()) * 42 + 4);
        const theta = random() * Math.PI * 2;
        x = radius * Math.cos(theta);
        z = radius * Math.sin(theta);
        y = gaussian(random) * discThickness(radius) * 0.6 + discWarp(x, z);
        color = HAZE;
        glow *= 0.7;
      } else {
        // Spiral arms.
        const arms = random() < 0.72 ? MAIN_ARMS : MINOR_ARMS;
        const offset = arms[Math.floor(random() * arms.length)];
        const radius = Math.min(132, ARM_INNER_RADIUS * 0.55 - Math.log(1 - random()) * 38);
        const frame = armFrame(offset, radius + gaussian(random) * 2);
        const across = gaussian(random) * (2.6 + radius * 0.07);
        x = frame.x + frame.normalX * across;
        z = frame.z + frame.normalZ * across;
        y = gaussian(random) * discThickness(radius) * 0.5 + discWarp(x, z);
        const tint = random();
        color = tint < 0.04 ? HII : tint < 0.1 ? VIOLET : ARM[Math.floor(random() * ARM.length)];
      }

      positions.set([x, y, z], i * 3);
      colors.set(color, i * 3);
      sizes[i] = 0.8 + Math.pow(random(), 3) * 2;
      brightness[i] = glow;
      seeds[i] = random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uViewportHeight: { value: 1 },
          uReveal: { value: 0 },
        },
        vertexShader: dustVertexShader,
        fragmentShader: dustFragmentShader,
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
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uViewportHeight.value = state.size.height;
    material.uniforms.uReveal.value = revealProgress(state.clock.elapsedTime);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
