"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "./LoadingScreen";

/** WebGL and window-dependent code only ever runs in the browser. */
const GalaxyApp = dynamic(() => import("./GalaxyApp"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export function GalaxyExperience() {
  return <GalaxyApp />;
}
