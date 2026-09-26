"use client";

import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGalaxyStore } from "@/store/galaxyStore";
import GalaxyScene from "./galaxy/GalaxyScene";
import { Header } from "./ui/Header";
import { IntroOverlay } from "./ui/IntroOverlay";
import { Legend } from "./ui/Legend";
import { RepositoryCard } from "./ui/RepositoryCard";
import { ResultsStatus } from "./ui/ResultsStatus";
import { SimilarBanner } from "./ui/SimilarBanner";

/** Client-only root: the WebGL galaxy with the interface layered over it. */
export default function GalaxyApp() {
  useKeyboardShortcuts();

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
  const cardOpen = useGalaxyStore((s) => s.selectedIndex >= 0);
  if (cardOpen) return null;
  return (
    <p className="pointer-events-none absolute bottom-5 right-5 z-10 hidden font-mono text-[10.5px] text-ink-faint md:block">
      Sample universe · {count} repositories · approximate star counts
    </p>
  );
}
