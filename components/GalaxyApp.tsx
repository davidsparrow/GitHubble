"use client";

import GalaxyScene from "./galaxy/GalaxyScene";

/** Client-only root: the WebGL galaxy with the interface layered over it. */
export default function GalaxyApp() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-space-950">
      <GalaxyScene />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55)_100%)]"
      />
    </div>
  );
}
