"use client";

import { MOBILE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useGalaxyStore } from "@/store/galaxyStore";
import { FrameIcon } from "./icons";

/** How many stars the current search and filters light up, with quick actions. */
export function ResultsStatus() {
  const searching = useGalaxyStore((s) => s.searchMask !== null);
  const filtering = useGalaxyStore((s) => s.filterMask !== null);
  const resultCount = useGalaxyStore((s) => s.resultCount);
  const total = useGalaxyStore((s) => s.dataset.repositories.length);
  const similarMode = useGalaxyStore((s) => s.similarAnchorIndex >= 0);
  const sheetOpen = useGalaxyStore((s) => s.selectedIndex >= 0);
  const frameResults = useGalaxyStore((s) => s.frameResults);
  const clearSearchAndFilters = useGalaxyStore((s) => s.clearSearchAndFilters);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  if ((!searching && !filtering) || similarMode || (isMobile && sheetOpen)) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3 md:bottom-5">
      <div
        role="status"
        aria-live="polite"
        className="glass pointer-events-auto flex animate-pop-in items-center gap-1 rounded-full py-1 pl-4 pr-1 text-[12.5px]"
      >
        <span className="mr-2 text-ink-muted">
          <span className="font-mono text-ink">{resultCount}</span> of {total} repositories
        </span>
        <button
          type="button"
          onClick={frameResults}
          disabled={resultCount === 0}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink disabled:opacity-40"
        >
          <FrameIcon className="size-3.5" />
          Frame
        </button>
        <button
          type="button"
          onClick={clearSearchAndFilters}
          className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-ink transition-colors hover:bg-white/[0.16]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
