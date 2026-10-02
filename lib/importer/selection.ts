import type { Candidate } from "./candidate";

/**
 * Picks up to `limit` repositories by taking turns across the per-topic result
 * lists (each already sorted by stars). Every topic contributes its most-starred
 * repository before any topic contributes its second, which keeps the galaxy
 * diverse; topics that run dry simply drop out of the rotation.
 */
export function selectDiverse(
  lists: readonly (readonly Candidate[])[],
  limit: number,
  accept: (candidate: Candidate) => boolean = () => true,
): Candidate[] {
  const chosen = new Map<number, Candidate>();
  const cursors = lists.map(() => 0);
  let progressed = true;

  while (chosen.size < limit && progressed) {
    progressed = false;
    for (let q = 0; q < lists.length && chosen.size < limit; q++) {
      const list = lists[q];
      while (cursors[q] < list.length) {
        const candidate = list[cursors[q]++];
        if (chosen.has(candidate.githubId) || !accept(candidate)) continue;
        chosen.set(candidate.githubId, candidate);
        progressed = true;
        break;
      }
    }
  }

  return [...chosen.values()];
}
