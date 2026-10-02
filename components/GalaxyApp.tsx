"use client";

import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { formatRelativeTime } from "@/lib/format";
import { useGalaxyStore } from "@/store/galaxyStore";
import GalaxyScene from "./galaxy/GalaxyScene";
import { loadGalaxyDataset } from "./loadGalaxyDataset";
import { LoadingScreen } from "./LoadingScreen";
import { Header } from "./ui/Header";
import { IntroOverlay } from "./ui/IntroOverlay";
import { Legend } from "./ui/Legend";
import { RepositoryCard } from "./ui/RepositoryCard";
import { ResultsStatus } from "./ui/ResultsStatus";
import { SimilarBanner } from "./ui/SimilarBanner";

/**
 * Client-only root. Loads the galaxy first, so the scene mounts once with its
 * final dataset (camera framing and the intro depend on it), then layers the
 * interface over the WebGL canvas.
 */
export default function GalaxyApp() {
  const [ready, setReady] = useState(false);
  useKeyboardShortcuts();

  useEffect(() => {
    let cancelled = false;
    loadGalaxyDataset().then((dataset) => {
      if (cancelled) return;
      useGalaxyStore.getState().setDataset(dataset);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <LoadingScreen />;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-space-950">
      <GalaxyScene />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55)_100%)]"
      />
      <Header />
      <SimilarBanner />
      <ResultsStatus />
      <Legend />
      <DatasetNote />
      <RepositoryCard />
      <IntroOverlay />
    </div>
  );
}

function DatasetNote() {
  const count = useGalaxyStore((s) => s.dataset.repositories.length);
  const source = useGalaxyStore((s) => s.dataset.source);
  const indexedAt = useGalaxyStore((s) => s.dataset.indexedAt);
  const cardOpen = useGalaxyStore((s) => s.selectedIndex >= 0);
  if (cardOpen) return null;
  const total = count.toLocaleString("en-US");
  return (
    <p className="pointer-events-none absolute bottom-5 right-5 z-10 hidden font-mono text-[10.5px] text-ink-faint xl:block">
      {source === "live"
        ? `Live GitHub data · ${total} repositories${indexedAt ? ` · indexed ${formatRelativeTime(indexedAt)}` : ""}`
        : source === "synthetic"
          ? `Synthetic stress-test universe · ${total} repositories`
          : `Sample universe · ${total} repositories · approximate star counts`}
    </p>
  );
}
