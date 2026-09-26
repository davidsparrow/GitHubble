"use client";

import { cn } from "@/lib/cn";
import { useGalaxyStore } from "@/store/galaxyStore";
import { FilterBar } from "./FilterBar";
import { ResetIcon, SparkleIcon } from "./icons";
import { SearchBar } from "./SearchBar";
import { ViewSwitcher } from "./ViewSwitcher";

export function Header() {
  const resetView = useGalaxyStore((s) => s.resetView);
  // On phones the filter row steps aside while a repository or neighborhood is in focus.
  const focused = useGalaxyStore((s) => s.selectedIndex >= 0 || s.similarAnchorIndex >= 0);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40">
      <div className="pointer-events-auto relative z-10 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-space-950/50 px-3 backdrop-blur-xl sm:gap-4 sm:px-5">
        <Logo />
        <div className="flex min-w-0 flex-1 justify-center">
          <SearchBar />
        </div>
        <ViewSwitcher />
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view"
          title="Reset view (R)"
          className="hidden size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.06] hover:text-ink sm:grid"
        >
          <ResetIcon className="size-4" />
        </button>
      </div>
      <div className={cn("mt-2.5 flex justify-start px-2 sm:justify-center sm:px-4", focused && "max-md:hidden")}>
        <FilterBar />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2 sm:w-44 lg:w-56">
      <SparkleIcon className="size-5 text-white drop-shadow-[0_0_6px_rgb(185_200_255/0.9)]" />
      <span className="hidden text-[15px] font-medium tracking-tight text-white sm:inline">GitHubble</span>
    </div>
  );
}
