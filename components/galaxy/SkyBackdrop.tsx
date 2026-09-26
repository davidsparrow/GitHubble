"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createRandom } from "@/lib/random";
import { isLowPowerDevice } from "./sceneEnvironment";
import { dustFragmentShader, skyVertexShader } from "./shaders";
import { hexToRgb } from "./starBuffers";

const SKY_RADIUS = 4000;
const TINTS = ["#ffffff", "#dbe3ff", "#c3cfff", "#ffe8cf", "#e9dcff"].map(hexToRgb);

/** Faint, fixed-size background stars that travel with the camera (effectively at infinity). */
export function SkyBackdrop() {
  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const count = isLowPowerDevice() ? 1400 : 2600;
    const random = createRandom(42);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = random() * Math.PI * 2;
      const cosPhi = 2 * random() - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      positions.set([SKY_RADIUS * sinPhi * Math.cos(theta), SKY_RADIUS * cosPhi, SKY_RADIUS * sinPhi * Math.sin(theta)], i * 3);
      colors.set(TINTS[Math.floor(random() * TINTS.length)], i * 3);
      sizes[i] = 0.8 + Math.pow(random(), 4) * 1.4;
      brightness[i] = 0.1 + Math.pow(random(), 3) * 0.5;
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
        uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 } },
        vertexShader: skyVertexShader,
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
    group.current?.position.copy(state.camera.position);
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
