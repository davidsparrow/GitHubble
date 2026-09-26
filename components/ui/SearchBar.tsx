"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SEARCH_INPUT_ID } from "@/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/format";
import { rankMatches, tokenize } from "@/lib/search";
import { CLUSTER_BY_ID } from "@/lib/taxonomy";
import { useGalaxyStore } from "@/store/galaxyStore";
import { TOP_CHROME_HEIGHT } from "../layoutMetrics";
import { CloseIcon, SearchIcon } from "./icons";

/** Once typing settles, the camera frames whatever lit up. */
const FRAME_DELAY_MS = 850;


export function SearchBar() {
  const query = useGalaxyStore((s) => s.query);
  const setQuery = useGalaxyStore((s) => s.setQuery);
  const dataset = useGalaxyStore((s) => s.dataset);
  const filterMask = useGalaxyStore((s) => s.filterMask);
  const resultCount = useGalaxyStore((s) => s.resultCount);
  const select = useGalaxyStore((s) => s.select);
  const frameResults = useGalaxyStore((s) => s.frameResults);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const hasQuery = query.trim().length > 0;
  const suggestions = useMemo(
    () => rankMatches(dataset.search, tokenize(query), { eligible: filterMask, limit: 7 }),
    [dataset, query, filterMask],
  );

  useEffect(() => {
    if (!hasQuery) return;
    const timer = window.setTimeout(frameResults, FRAME_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, hasQuery, frameResults]);

  const showPanel = open && hasQuery;

  // While suggestions are open, the camera frames results in the space below them.
  useLayoutEffect(() => {
    const { setSearchInset } = useGalaxyStore.getState();
    const panel = panelRef.current;
    if (!showPanel || !panel) {
      setSearchInset(0);
      return;
    }
    const measure = () => setSearchInset(Math.max(0, Math.round(panel.getBoundingClientRect().bottom - TOP_CHROME_HEIGHT)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      setSearchInset(0);
    };
  }, [showPanel]);

  const choose = (index: number) => {
    select(index, "fly");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (suggestions.length === 0) return;
      // -1 is "no suggestion" (Enter frames every match); wrap around at both ends.
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => {
        const next = current + step;
        if (next >= suggestions.length) return -1;
        if (next < -1) return suggestions.length - 1;
        return next;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && suggestions[active]) choose(suggestions[active].index);
      else {
        frameResults();
        setOpen(false);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (open && hasQuery) setOpen(false);
      else if (query) setQuery("");
      else inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-xl">
      <div
        className={cn(
          "flex h-10 items-center gap-2.5 rounded-xl border px-3 transition-colors",
          "border-white/[0.09] bg-white/[0.04] focus-within:border-nebula/45 focus-within:bg-white/[0.06]",
        )}
      >
        <SearchIcon className="size-4 shrink-0 text-ink-muted" />
        <input
          ref={inputRef}
          id={SEARCH_INPUT_ID}
          type="search"
          value={query}
          placeholder="Search the galaxy..."
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label="Search repositories"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setQuery("")}
            className="grid size-6 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-white/10 hover:text-ink"
          >
            <CloseIcon className="size-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
            /
          </kbd>
        )}
      </div>

      {showPanel && (
        <div ref={panelRef} className="glass-dense absolute inset-x-0 top-12 z-10 animate-pop-in overflow-hidden rounded-xl p-1.5">
          {suggestions.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-muted">
              No repositories match “{query.trim()}”{filterMask ? " with the current filters" : ""}.
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Matching repositories">
              {suggestions.map((match, k) => {
                const repo = dataset.repositories[match.index];
                const color = CLUSTER_BY_ID[repo.clusterId].color;
                return (
                  <li
                    key={repo.id}
                    id={`${listId}-${k}`}
                    role="option"
                    aria-selected={k === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(match.index)}
                    onMouseEnter={() => setActive(k)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                      k === active && "bg-white/[0.07]",
                    )}
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] text-ink">
                        <span className="text-ink-muted">{repo.owner}/</span>
                        {repo.name}
                      </span>
                      <span className="block truncate text-[11.5px] text-ink-muted">{repo.description}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-starlight">★ {formatCompact(repo.stars)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/[0.06] px-2.5 pb-1 pt-2 text-[11px] text-ink-faint">
            <span>
              <span className="font-mono text-ink-muted">{resultCount}</span> {resultCount === 1 ? "star" : "stars"} lit up
            </span>
            <span className="hidden sm:inline">↵ frame all · ↑↓ choose · esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}
