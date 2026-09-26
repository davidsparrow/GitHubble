"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const SHOW_FOR_MS = 4200;
const FADE_MS = 900;

/** A brief title card during the opening glide-in; leaves on first interaction. */
export function IntroOverlay() {
  const [phase, setPhase] = useState<"visible" | "leaving" | "gone">("visible");

  useEffect(() => {
    const leave = () => setPhase((current) => (current === "visible" ? "leaving" : current));
    const timer = window.setTimeout(leave, SHOW_FOR_MS);
    const events = ["pointerdown", "wheel", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, leave, { once: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, leave));
    };
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-[17vh] z-10 flex justify-center px-6 transition-opacity duration-[900ms]",
        phase === "leaving" && "opacity-0",
      )}
    >
      <div className="animate-fade-in text-center [animation-delay:350ms]">
        <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-ink-muted">GitHubble</p>
        <p className="mt-3 text-[26px] font-light tracking-tight text-white sm:text-[32px]">Every star is a repository.</p>
        <p className="mt-2 text-[14px] text-ink-muted">Brighter stars have more GitHub stars. Related projects gather in neighborhoods.</p>
      </div>
    </div>
  );
}
