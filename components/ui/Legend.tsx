"use client";

import { formatCompact } from "@/lib/format";
import { LEGEND_STAR_COUNTS, starBaseSize, starMagnitude } from "@/lib/starScale";
import { useGalaxyStore } from "@/store/galaxyStore";

/** Magnitude scale + controls hint, so "bigger = more stars" is obvious at a glance. */
export function Legend() {
  const viewMode = useGalaxyStore((s) => s.viewMode);

  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-10 hidden lg:block">
      <div className="glass w-[252px] rounded-xl px-4 pb-3 pt-3.5">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-muted">Every star is a repository</p>
        <div className="mt-2 flex items-end justify-between">
          {LEGEND_STAR_COUNTS.map((count) => (
            <div key={count} className="flex flex-col items-center gap-1.5">
              <span className="grid h-11 w-10 place-items-center">
                <LegendStar stars={count} />
              </span>
              <span className="font-mono text-[10px] text-ink-faint">{formatCompact(count)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
          Size and brightness follow GitHub stars.
          <br />
          {viewMode === "telescope"
            ? "Drag to look around · scroll to zoom · click a star."
            : "Drag to pan · scroll to zoom · click a star."}
        </p>
      </div>
    </div>
  );
}

/** A CSS rendition of the star sprite: white core, soft blue-white halo. */
function LegendStar({ stars }: { stars: number }) {
  const size = Math.min(44, starBaseSize(stars) * 0.85);
  const magnitude = starMagnitude(stars);
  const core = Math.max(8, 16 - magnitude * 6);
  return (
    <span
      className="block rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, #fff 0%, #fff ${core * 0.5}%, rgb(200 212 255 / ${0.35 + 0.45 * magnitude}) ${core}%, rgb(143 157 255 / 0) 70%)`,
      }}
    />
  );
}
