/**
 * Maps GitHub star counts onto the visual scale. Size and brightness depend on
 * star count only, on a log scale so the giants don't swamp the galaxy.
 *
 * These constants are shared with the GLSL star shader (interpolated into its
 * source) and with CPU-side picking, so all three agree on a star's on-screen size.
 */

export const STAR_COUNT_MIN = 100;
export const STAR_COUNT_MAX = 500_000;

/** Star counts shown in the legend, from a faint point to a giant. */
export const LEGEND_STAR_COUNTS = [100, 1_000, 10_000, 100_000, 500_000] as const;

/** Projected pixels-per-world-unit at which stars render at their base size. */
export const REFERENCE_PX_PER_UNIT = 5;
/** How strongly apparent size follows zoom: 0 = constant pixels, 1 = true perspective. */
export const ZOOM_SIZE_EXPONENT = 0.42;
export const MIN_ZOOM_SIZE_SCALE = 0.45;
export const MAX_ZOOM_SIZE_SCALE = 3;

const LOG_MIN = Math.log10(STAR_COUNT_MIN);
const LOG_MAX = Math.log10(STAR_COUNT_MAX);

/** Normalized magnitude in [0, 1]: 0 at ≤100 stars, 1 at ≥500k. */
export function starMagnitude(stars: number): number {
  const value = (Math.log10(Math.max(stars, 1)) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return Math.min(1, Math.max(0, value));
}

/** Sprite diameter (CSS px, halo included) at the reference zoom. */
export function starBaseSize(stars: number): number {
  return 5 + 46 * Math.pow(starMagnitude(stars), 1.6);
}

/** Brightness multiplier in [0.5, 1]. */
export function starIntensity(stars: number): number {
  return 0.5 + 0.5 * starMagnitude(stars);
}

/** Size multiplier for a star seen at `pxPerUnit` projected pixels per world unit. */
export function zoomSizeScale(pxPerUnit: number): number {
  const scale = Math.pow(pxPerUnit / REFERENCE_PX_PER_UNIT, ZOOM_SIZE_EXPONENT);
  return Math.min(MAX_ZOOM_SIZE_SCALE, Math.max(MIN_ZOOM_SIZE_SCALE, scale));
}
