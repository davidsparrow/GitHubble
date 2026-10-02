"use client";

import { useLayoutEffect, useRef } from "react";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/cn";
import { displayName, formatCompact, formatRelativeTime, formatStars } from "@/lib/format";
import { CLUSTER_BY_ID, languageColor } from "@/lib/taxonomy";
import { useGalaxyStore } from "@/store/galaxyStore";
import { ArrowLeftIcon, CloseIcon, ExternalIcon, SparkleIcon } from "./icons";

/** Topic chips shown on the card; the rest are summarized as "+N". */
const MAX_TOPICS = 8;

/**
 * The selected repository. Floats on the right on desktop and becomes a bottom
 * sheet on phones. It reports the screen area it covers so the camera can keep
 * the selected star in the visible part of the galaxy.
 */
export function RepositoryCard() {
  const selectedIndex = useGalaxyStore((s) => s.selectedIndex);
  const dataset = useGalaxyStore((s) => s.dataset);
  const anchorIndex = useGalaxyStore((s) => s.similarAnchorIndex);
  const select = useGalaxyStore((s) => s.select);
  const showSimilar = useGalaxyStore((s) => s.showSimilar);
  const exitSimilar = useGalaxyStore((s) => s.exitSimilar);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const cardRef = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; offset: number } | null>(null);
  const open = selectedIndex >= 0;

  useLayoutEffect(() => {
    const { setCardInset } = useGalaxyStore.getState();
    const card = cardRef.current;
    if (!open || !card) {
      setCardInset({ right: 0, bottom: 0 });
      return;
    }
    const measure = () => {
      const rect = card.getBoundingClientRect();
      setCardInset(
        isMobile
          ? { right: 0, bottom: Math.round(window.innerHeight - rect.top) }
          : { right: Math.round(window.innerWidth - rect.left), bottom: 0 },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      setCardInset({ right: 0, bottom: 0 });
    };
  }, [open, isMobile]);

  // Phones: drag the sheet's handle down to dismiss it.
  const onHandleDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, offset: 0 };
    if (cardRef.current) cardRef.current.style.transition = "none";
  };
  const onHandleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !cardRef.current) return;
    drag.current.offset = Math.max(0, event.clientY - drag.current.startY);
    cardRef.current.style.transform = `translateY(${drag.current.offset}px)`;
  };
  const onHandleUp = () => {
    const card = cardRef.current;
    const offset = drag.current?.offset ?? 0;
    drag.current = null;
    if (!card) return;
    card.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
    if (offset > 90) {
      card.style.transform = "translateY(100%)";
      window.setTimeout(() => select(-1), 200);
    } else {
      card.style.transform = "";
    }
  };

  if (!open) return null;

  const repo = dataset.repositories[selectedIndex];
  const cluster = CLUSTER_BY_ID[repo.clusterId];
  const inSimilarMode = anchorIndex >= 0;
  const isAnchor = anchorIndex === selectedIndex;

  return (
    <aside
      ref={cardRef}
      aria-label={`${repo.owner}/${repo.name}`}
      className={cn(
        "glass fixed z-30 flex flex-col overflow-hidden",
        "max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[50dvh] max-md:animate-sheet-in max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0",
        "md:right-4 md:top-[108px] md:max-h-[calc(100dvh-128px)] md:w-[360px] md:animate-card-in md:rounded-2xl",
      )}
    >
      <div
        aria-hidden
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        className="flex h-6 shrink-0 cursor-grab touch-none items-end justify-center md:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-white/25" />
      </div>
      <div className="overflow-y-auto overscroll-contain px-5 pb-5 pt-2 md:pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-muted">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: cluster.color, boxShadow: `0 0 8px ${cluster.color}` }}
              />
              {cluster.label}
            </p>
            <h2 className="mt-2 break-words font-mono text-[17px] leading-snug">
              <span className="text-ink-muted">{repo.owner}/</span>
              <span className="font-semibold text-white">{repo.name}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => select(-1)}
            aria-label="Close"
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/[0.08] hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <span className="font-mono font-medium text-starlight">★ {formatStars(repo.stars)}</span>
          <span className="inline-flex items-center gap-1.5 text-ink">
            <span className="size-2 rounded-full" style={{ backgroundColor: languageColor(repo.language) }} />
            {repo.language}
          </span>
          <span className="text-ink-faint">Updated {formatRelativeTime(repo.updatedAt)}</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-muted">
          {repo.problemCategory} · {repo.platform}
        </p>

        <p className="mt-3 text-[14px] leading-relaxed text-ink/90">{repo.description}</p>
        {repo.homepageUrl && (
          <a
            href={repo.homepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1 text-[12.5px] text-nebula hover:text-nebula-soft"
          >
            <span className="truncate">{websiteLabel(repo.homepageUrl)}</span>
            <ExternalIcon className="size-3 shrink-0" />
          </a>
        )}

        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Topics">
          {repo.topics.slice(0, MAX_TOPICS).map((topic) => (
            <li
              key={topic}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-ink-muted"
            >
              {topic}
            </li>
          ))}
          {repo.topics.length > MAX_TOPICS && (
            <li className="px-1 py-0.5 font-mono text-[11px] text-ink-faint">+{repo.topics.length - MAX_TOPICS}</li>
          )}
        </ul>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href={repo.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-ink transition-colors hover:border-white/20 hover:bg-white/[0.08]"
          >
            View on GitHub
            <ExternalIcon className="size-3.5 text-ink-muted" />
          </a>
          {isAnchor ? (
            <button
              type="button"
              onClick={exitSimilar}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[13px] text-ink transition-colors hover:bg-white/[0.08]"
            >
              Return to Galaxy
            </button>
          ) : (
            <button
              type="button"
              onClick={() => showSimilar(selectedIndex)}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-nebula/90 text-[13px] font-medium text-space-950 shadow-[0_0_24px_-6px_rgb(143_157_255/0.8)] transition-colors hover:bg-nebula"
            >
              <SparkleIcon className="size-3.5" />
              Show Similar
            </button>
          )}
        </div>

        {inSimilarMode && <Neighborhood />}
      </div>
    </aside>
  );
}

/** The Show Similar neighborhood, kept visible while you step through its members. */
function Neighborhood() {
  const dataset = useGalaxyStore((s) => s.dataset);
  const anchorIndex = useGalaxyStore((s) => s.similarAnchorIndex);
  const selectedIndex = useGalaxyStore((s) => s.selectedIndex);
  const similar = useGalaxyStore((s) => s.similar);
  const select = useGalaxyStore((s) => s.select);
  const hover = useGalaxyStore((s) => s.hover);
  const anchor = dataset.repositories[anchorIndex];

  return (
    <section className="mt-5 border-t border-white/[0.07] pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-ink-muted">
          Neighborhood of <span className="font-mono normal-case tracking-normal text-ink">{displayName(anchor)}</span>
        </h3>
        {selectedIndex !== anchorIndex && (
          <button
            type="button"
            onClick={() => select(anchorIndex, "center")}
            className="flex shrink-0 items-center gap-1 text-[12px] text-ink-muted hover:text-ink"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back
          </button>
        )}
      </div>
      {similar.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-muted">No close neighbors match the current filters.</p>
      ) : (
        <ol className="mt-2 space-y-0.5">
          {similar.map((match) => {
            const repo = dataset.repositories[match.index];
            const color = CLUSTER_BY_ID[repo.clusterId].color;
            const current = match.index === selectedIndex;
            return (
              <li key={repo.id}>
                <button
                  type="button"
                  onClick={() => select(match.index, "center")}
                  onMouseEnter={() => hover(match.index)}
                  onMouseLeave={() => hover(-1)}
                  aria-current={current || undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                    current ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
                  )}
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] text-ink">{displayName(repo)}</span>
                    <span className="block truncate text-[11px] text-ink-faint">{match.reasons[0]}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-starlight/80">★ {formatCompact(repo.stars)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** "https://www.example.com/docs" → "example.com/docs" */
function websiteLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname.replace(/^www\./, "")}${pathname === "/" ? "" : pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}
