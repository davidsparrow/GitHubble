import { useEffect } from "react";
import { hasActiveFilters } from "@/lib/filters";
import { useGalaxyStore } from "@/store/galaxyStore";

export const SEARCH_INPUT_ID = "galaxy-search";

/**
 * /, ⌘K or Ctrl+K  focus search
 * Esc              close the card → leave Show Similar → clear search and filters
 * V                switch view
 * R                reset the view
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest("input, textarea, select, [contenteditable='true']");
      const store = useGalaxyStore.getState();

      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        if (store.selectedIndex >= 0) store.select(-1);
        else if (store.similarAnchorIndex >= 0) store.exitSimilar();
        else if (store.query || hasActiveFilters(store.filters)) store.clearSearchAndFilters();
      } else if (event.key.toLowerCase() === "v") {
        store.toggleViewMode();
      } else if (event.key.toLowerCase() === "r") {
        store.resetView();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
