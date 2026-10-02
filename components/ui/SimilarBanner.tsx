"use client";

import { displayName } from "@/lib/format";
import { useGalaxyStore } from "@/store/galaxyStore";
import { SparkleIcon } from "./icons";

/** Visible while Show Similar is active; the one-click way back to the whole galaxy. */
export function SimilarBanner() {
  const anchorIndex = useGalaxyStore((s) => s.similarAnchorIndex);
  const count = useGalaxyStore((s) => s.similar.length);
  const dataset = useGalaxyStore((s) => s.dataset);
  const exitSimilar = useGalaxyStore((s) => s.exitSimilar);
  if (anchorIndex < 0) return null;
  const anchor = dataset.repositories[anchorIndex];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[108px] z-20 flex justify-center px-3 max-md:top-16">
      <div
        role="status"
        className="glass pointer-events-auto flex max-w-full animate-pop-in items-center gap-3 rounded-full py-1 pl-4 pr-1 text-[12.5px]"
      >
        <SparkleIcon className="size-3.5 shrink-0 text-nebula-soft" />
        <span className="min-w-0 truncate text-ink-muted">
          <span className="hidden sm:inline">Neighborhood of </span>
          <span className="font-mono text-ink">{displayName(anchor)}</span>
          <span className="text-ink-faint"> · {count} similar</span>
        </span>
        <button
          type="button"
          onClick={exitSimilar}
          className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-white/[0.16]"
        >
          Return to Galaxy
        </button>
      </div>
    </div>
  );
}
