"use client";

import { Canvas } from "@react-three/fiber";
import { Component, type ReactNode } from "react";
import { GalaxyCamera, TELESCOPE_FOV } from "./GalaxyCamera";
import { GalaxyDust } from "./GalaxyDust";
import { Nebulae } from "./Nebulae";
import { PointerInteraction } from "./PointerInteraction";
import { RepositoryStars } from "./RepositoryStars";
import { SceneLabels } from "./SceneLabels";
import { SelectionReticle } from "./SelectionReticle";
import { SimilarConstellation } from "./SimilarConstellation";
import { SkyBackdrop } from "./SkyBackdrop";

export const SPACE_COLOR = "#03040a";

/** The WebGL galaxy. Everything interactive is a handful of draw calls, not per-star components. */
export default function GalaxyScene() {
  return (
    <SceneErrorBoundary>
      <Canvas
        dpr={[1, 2]}
        flat
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ fov: TELESCOPE_FOV, near: 0.5, far: 12000, position: [0, 160, 260] }}
        style={{ position: "absolute", inset: 0 }}
        aria-label="Galaxy of GitHub repositories. Use the search field to find repositories without a pointer."
      >
        <color attach="background" args={[SPACE_COLOR]} />
        <SkyBackdrop />
        <GalaxyDust />
        <Nebulae />
        <RepositoryStars />
        <SimilarConstellation />
        <SelectionReticle />
        <GalaxyCamera />
        <PointerInteraction />
        <SceneLabels />
      </Canvas>
    </SceneErrorBoundary>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="absolute inset-0 grid place-items-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm font-medium text-ink">The telescope couldn&apos;t start.</p>
          <p className="mt-2 text-sm text-ink-muted">
            GitHubble needs WebGL. Try a current version of Chrome, Edge, Firefox or Safari, or enable hardware
            acceleration.
          </p>
        </div>
      </div>
    );
  }
}
