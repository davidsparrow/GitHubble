import { describe, expect, it } from "vitest";
import { LEGEND_STAR_COUNTS, starBaseSize, starIntensity, starMagnitude, zoomSizeScale } from "../starScale";

describe("starScale", () => {
  it("maps star counts onto [0, 1] logarithmically", () => {
    expect(starMagnitude(0)).toBe(0);
    expect(starMagnitude(100)).toBe(0);
    expect(starMagnitude(500_000)).toBe(1);
    expect(starMagnitude(5_000_000)).toBe(1);
    // Each decade adds the same amount.
    const step = starMagnitude(10_000) - starMagnitude(1_000);
    expect(starMagnitude(100_000) - starMagnitude(10_000)).toBeCloseTo(step, 10);
  });

  it("grows size and brightness monotonically across the legend", () => {
    const sizes = LEGEND_STAR_COUNTS.map(starBaseSize);
    const intensities = LEGEND_STAR_COUNTS.map(starIntensity);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      expect(intensities[i]).toBeGreaterThan(intensities[i - 1]);
    }
  });

  it("keeps the biggest star within a sane multiple of the smallest", () => {
    const ratio = starBaseSize(500_000) / starBaseSize(100);
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(15);
  });

  it("clamps the zoom size multiplier", () => {
    expect(zoomSizeScale(5)).toBeCloseTo(1);
    expect(zoomSizeScale(0.0001)).toBeCloseTo(0.45);
    expect(zoomSizeScale(10_000)).toBe(3);
  });
});
