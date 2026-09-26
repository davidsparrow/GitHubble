/**
 * Per-star emphasis targets. The renderer eases each star's current values
 * towards these, so filtering and selection fade rather than pop.
 *
 * visibility: 1 = normal, lower = dimmed (and smaller)
 * highlight:  0 = normal, 1 = strongly emphasized
 */

export const VISIBILITY = {
  filteredOut: 0.05,
  searchMiss: 0.16,
  similarMiss: 0.09,
  otherNeighborhood: 0.5,
  sameNeighborhood: 0.9,
} as const;

/** Stars dimmer than this can't be hovered or clicked. */
export const INTERACTIVE_VISIBILITY = 0.08;

export type StarTargetInputs = {
  /** null = no filters active. */
  filterMask: Uint8Array | null;
  /** null = no search query. */
  searchMask: Uint8Array | null;
  /** Show Similar neighbors: repository index → relative strength (0…1). null = not in similar mode. */
  similar: ReadonlyMap<number, number> | null;
  anchorIndex: number;
  selectedIndex: number;
  clusterIndex: Uint8Array;
};

export function computeStarTargets(inputs: StarTargetInputs, visibility: Float32Array, highlight: Float32Array): void {
  const { filterMask, searchMask, similar, anchorIndex, selectedIndex, clusterIndex } = inputs;
  const selectedCluster = selectedIndex >= 0 ? clusterIndex[selectedIndex] : -1;

  for (let i = 0; i < visibility.length; i++) {
    let v = 1;
    let h = 0;

    if (filterMask && !filterMask[i]) {
      v = VISIBILITY.filteredOut;
    } else if (similar) {
      if (i === anchorIndex) h = 1;
      else if (similar.has(i)) h = 0.35 + 0.65 * similar.get(i)!;
      else v = VISIBILITY.similarMiss;
    } else {
      if (searchMask) {
        if (searchMask[i]) h = 0.7;
        else v = VISIBILITY.searchMiss;
      }
      if (selectedIndex >= 0 && i !== selectedIndex) {
        v *= clusterIndex[i] === selectedCluster ? VISIBILITY.sameNeighborhood : VISIBILITY.otherNeighborhood;
      }
    }

    if (i === selectedIndex) {
      v = 1;
      h = 1;
    }

    visibility[i] = v;
    highlight[i] = h;
  }
}
