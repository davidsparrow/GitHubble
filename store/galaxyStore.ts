import { create } from "zustand";
import { computeFilterMask, EMPTY_FILTERS, toggleValue, type FilterKey, type Filters } from "@/lib/filters";
import { getSampleDataset, type GalaxyDataset } from "@/lib/repositoryData";
import { computeSearchMask, tokenize } from "@/lib/search";
import { findSimilar, type SimilarRepository } from "@/lib/similarity";
import type { ViewMode } from "@/lib/types";

/**
 * A request for the camera rig. UI code describes *what* to look at; the rig
 * decides how to get there for the current view. `nonce` makes repeated
 * requests for the same thing distinct.
 */
export type CameraIntent =
  | { kind: "focus"; index: number; style: "fly" | "center"; nonce: number }
  | { kind: "frame"; indices: number[]; nonce: number }
  | { kind: "overview"; nonce: number };

export type FocusStyle = "fly" | "center" | "none";

type GalaxyState = {
  dataset: GalaxyDataset;
  viewMode: ViewMode;

  query: string;
  /** null when the query is empty. */
  searchMask: Uint8Array | null;
  filters: Filters;
  /** null when no filter is active. */
  filterMask: Uint8Array | null;
  /** Repositories passing both the search and the filters. */
  resultCount: number;

  /** Repository indices; -1 means none. */
  selectedIndex: number;
  hoveredIndex: number;
  similarAnchorIndex: number;
  similar: SimilarRepository[];

  cameraIntent: CameraIntent | null;
  /** Screen area covered by the repository card, so the camera can keep the selection in view. */
  cardInset: { right: number; bottom: number };

  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setQuery: (query: string) => void;
  frameResults: () => void;
  toggleFilter: (key: FilterKey, value: string) => void;
  clearFilter: (key: FilterKey) => void;
  clearSearchAndFilters: () => void;
  select: (index: number, focus?: FocusStyle) => void;
  hover: (index: number) => void;
  showSimilar: (index: number) => void;
  exitSimilar: () => void;
  resetView: () => void;
  setCardInset: (inset: { right: number; bottom: number }) => void;
};

let nonce = 0;

function countResults(searchMask: Uint8Array | null, filterMask: Uint8Array | null, total: number): number {
  if (!searchMask && !filterMask) return total;
  let count = 0;
  for (let i = 0; i < total; i++) {
    if ((!searchMask || searchMask[i]) && (!filterMask || filterMask[i])) count++;
  }
  return count;
}

export function resultIndices(state: Pick<GalaxyState, "searchMask" | "filterMask" | "dataset">): number[] {
  const indices: number[] = [];
  const { searchMask, filterMask } = state;
  for (let i = 0; i < state.dataset.repositories.length; i++) {
    if ((!searchMask || searchMask[i]) && (!filterMask || filterMask[i])) indices.push(i);
  }
  return indices;
}

export const useGalaxyStore = create<GalaxyState>()((set, get) => {
  const applyFilters = (filters: Filters) => {
    const { dataset, searchMask, similarAnchorIndex } = get();
    const { mask } = computeFilterMask(dataset.repositories, filters);
    set({
      filters,
      filterMask: mask,
      resultCount: countResults(searchMask, mask, dataset.repositories.length),
      // Show Similar only considers repositories that pass the filters.
      ...(similarAnchorIndex >= 0 && {
        similar: findSimilar(dataset.repositories, dataset.similarity, similarAnchorIndex, { eligible: mask }),
      }),
    });
  };

  const dataset = getSampleDataset();

  return {
    dataset,
    viewMode: "telescope",
    query: "",
    searchMask: null,
    filters: EMPTY_FILTERS,
    filterMask: null,
    resultCount: dataset.repositories.length,
    selectedIndex: -1,
    hoveredIndex: -1,
    similarAnchorIndex: -1,
    similar: [],
    cameraIntent: null,
    cardInset: { right: 0, bottom: 0 },

    setViewMode: (viewMode) => set({ viewMode }),
    toggleViewMode: () => set({ viewMode: get().viewMode === "telescope" ? "above" : "telescope" }),

    setQuery: (query) => {
      const { dataset, filterMask } = get();
      const tokens = tokenize(query);
      const searchMask = tokens.length > 0 ? computeSearchMask(dataset.search, tokens).mask : null;
      set({ query, searchMask, resultCount: countResults(searchMask, filterMask, dataset.repositories.length) });
    },

    frameResults: () => {
      const state = get();
      if (!state.searchMask && !state.filterMask) return;
      const indices = resultIndices(state);
      if (indices.length > 0) set({ cameraIntent: { kind: "frame", indices, nonce: ++nonce } });
    },

    toggleFilter: (key, value) => applyFilters({ ...get().filters, [key]: toggleValue(get().filters[key], value) }),
    clearFilter: (key) => applyFilters({ ...get().filters, [key]: [] }),

    clearSearchAndFilters: () => {
      get().setQuery("");
      applyFilters(EMPTY_FILTERS);
    },

    select: (index, focus = "none") => {
      set({
        selectedIndex: index,
        ...(index >= 0 && focus !== "none" && { cameraIntent: { kind: "focus", index, style: focus, nonce: ++nonce } }),
      });
    },

    hover: (hoveredIndex) => {
      if (get().hoveredIndex !== hoveredIndex) set({ hoveredIndex });
    },

    showSimilar: (index) => {
      const { dataset, filterMask } = get();
      const similar = findSimilar(dataset.repositories, dataset.similarity, index, { eligible: filterMask });
      set({
        similarAnchorIndex: index,
        selectedIndex: index,
        similar,
        cameraIntent: { kind: "frame", indices: [index, ...similar.map((s) => s.index)], nonce: ++nonce },
      });
    },

    exitSimilar: () =>
      set({
        similarAnchorIndex: -1,
        similar: [],
        selectedIndex: -1,
        cameraIntent: { kind: "overview", nonce: ++nonce },
      }),

    resetView: () => set({ cameraIntent: { kind: "overview", nonce: ++nonce } }),

    setCardInset: (cardInset) => {
      const current = get().cardInset;
      if (current.right !== cardInset.right || current.bottom !== cardInset.bottom) set({ cardInset });
    },
  };
});
