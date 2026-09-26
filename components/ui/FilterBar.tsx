"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { activeFilterCount, facetCounts, FILTER_KEYS, FILTER_LABELS, type FilterKey } from "@/lib/filters";
import { languageColor } from "@/lib/taxonomy";
import { useGalaxyStore } from "@/store/galaxyStore";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "./icons";

const PANEL_WIDTH = 256;

export function FilterBar() {
  const filters = useGalaxyStore((s) => s.filters);
  const clearFilters = useGalaxyStore((s) => s.clearFilters);
  const [openKey, setOpenKey] = useState<FilterKey | null>(null);
  const active = activeFilterCount(filters);

  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 scrollbar-none">
      {FILTER_KEYS.map((key) => (
        <FilterDropdown
          key={key}
          filterKey={key}
          open={openKey === key}
          onOpenChange={(open) => setOpenKey(open ? key : null)}
        />
      ))}
      {active > 0 && (
        <button
          type="button"
          onClick={() => {
            clearFilters();
            setOpenKey(null);
          }}
          className="flex h-8 shrink-0 animate-pop-in items-center gap-1.5 rounded-full px-3 text-[12.5px] text-ink-muted transition-colors hover:text-ink"
        >
          <CloseIcon className="size-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterDropdown({
  filterKey,
  open,
  onOpenChange,
}: {
  filterKey: FilterKey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dataset = useGalaxyStore((s) => s.dataset);
  const filters = useGalaxyStore((s) => s.filters);
  const toggleFilter = useGalaxyStore((s) => s.toggleFilter);
  const clearFilter = useGalaxyStore((s) => s.clearFilter);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selected = filters[filterKey];
  const label = FILTER_LABELS[filterKey];
  const options = dataset.facets[filterKey];
  const counts = useMemo(() => facetCounts(dataset.repositories, filters, filterKey), [dataset, filters, filterKey]);

  // The bar scrolls horizontally on small screens, so the panel is positioned
  // against the viewport instead of inside the (clipping) scroll container.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    setPosition({ top: rect.bottom + 8, left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] backdrop-blur-md transition-colors",
          selected.length > 0
            ? "border-nebula/40 bg-nebula/15 text-ink"
            : "border-white/[0.08] bg-space-900/60 text-ink-muted hover:border-white/15 hover:text-ink",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-nebula/35 px-1.5 font-mono text-[10.5px] leading-4 text-white">
            {selected.length}
          </span>
        )}
        <ChevronDownIcon className={cn("size-3 transition-transform duration-300", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Filter by ${label}`}
          style={{ top: position.top, left: position.left, width: Math.min(PANEL_WIDTH, window.innerWidth - 16) }}
          className="glass-dense fixed z-40 animate-pop-in rounded-xl p-1.5"
        >
          <div className="max-h-[min(58vh,360px)] overflow-y-auto overscroll-contain">
            {options.map((value) => {
              const count = counts.get(value) ?? 0;
              const checked = selected.includes(value);
              return (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors hover:bg-white/[0.05]",
                    count === 0 && !checked && "opacity-40",
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    onChange={() => toggleFilter(filterKey, value)}
                  />
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-nebula/60",
                      checked ? "border-nebula bg-nebula/85 text-space-950" : "border-white/20",
                    )}
                  >
                    {checked && <CheckIcon className="size-3" strokeWidth={2.4} />}
                  </span>
                  {filterKey === "languages" && (
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: languageColor(value) }} />
                  )}
                  <span className="min-w-0 flex-1 truncate text-ink">{value}</span>
                  <span className="font-mono text-[11px] text-ink-faint">{count}</span>
                </label>
              );
            })}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => clearFilter(filterKey)}
              className="mt-1 w-full rounded-lg border-t border-white/[0.06] px-2.5 pb-1 pt-2 text-left text-[12px] text-ink-muted hover:text-ink"
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </>
  );
}
