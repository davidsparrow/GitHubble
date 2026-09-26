/** Small runtime facts the scene adapts to. Evaluated lazily, client-side only. */

let reducedMotion: boolean | null = null;
let lowPower: boolean | null = null;

export function prefersReducedMotion(): boolean {
  reducedMotion ??= window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reducedMotion;
}

/** Touch-first or small screens get lighter decorative layers. */
export function isLowPowerDevice(): boolean {
  lowPower ??= window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;
  return lowPower;
}

/** Intro "ignition" progress (0 → 1) for a scene clock reading, in seconds. */
export function revealProgress(elapsed: number): number {
  if (prefersReducedMotion()) return 1;
  const t = Math.min(1, Math.max(0, (elapsed - 0.15) / 2.6));
  return t * t * (3 - 2 * t);
}
