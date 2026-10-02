export function LoadingScreen() {
  return (
    <div className="grid h-dvh place-items-center bg-space-950">
      <div className="flex flex-col items-center gap-4">
        <span className="relative block size-2 rounded-full bg-white shadow-[0_0_24px_6px_rgb(185_200_255/0.55)] motion-safe:animate-pulse" />
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-ink-muted">Aligning the telescope</p>
      </div>
    </div>
  );
}
