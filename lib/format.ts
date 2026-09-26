const integerFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** 240421 → "240,421" */
export function formatStars(stars: number): string {
  return integerFormat.format(stars);
}

/** 240421 → "240.4K", 999 → "999" */
export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 days ago", "last month", … */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
