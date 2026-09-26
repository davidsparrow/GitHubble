"use client";

import { cn } from "@/lib/cn";
import type { ViewMode } from "@/lib/types";
import { useGalaxyStore } from "@/store/galaxyStore";
import { GalaxyIcon, TelescopeIcon } from "./icons";

const VIEWS: { mode: ViewMode; label: string; Icon: typeof TelescopeIcon }[] = [
  { mode: "telescope", label: "Telescope", Icon: TelescopeIcon },
  { mode: "above", label: "Above the Plane", Icon: GalaxyIcon },
];

export function ViewSwitcher() {
  const viewMode = useGalaxyStore((s) => s.viewMode);
  const setViewMode = useGalaxyStore((s) => s.setViewMode);

  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="relative grid shrink-0 grid-cols-2 rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5"
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white/[0.1] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] transition-transform duration-500 ease-out-expo"
        style={{ transform: viewMode === "above" ? "translateX(100%)" : "none" }}
      />
      {VIEWS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={viewMode === mode}
          aria-label={label}
          title={`${label} (V)`}
          onClick={() => setViewMode(mode)}
          className={cn(
            "relative flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12.5px] transition-colors xl:px-3.5",
            viewMode === mode ? "text-white" : "text-ink-muted hover:text-ink",
          )}
        >
          <Icon className="size-4" />
          <span className="hidden xl:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
