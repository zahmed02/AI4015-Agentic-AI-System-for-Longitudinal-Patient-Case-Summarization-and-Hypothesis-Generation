export const cleanCaseTitle = (title: string) => title.replace(/^\d+_/, "");

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function confidenceTone(c: number) {
  if (c >= 0.7) return { bar: "from-emerald-400 to-teal-400", text: "text-emerald-300" };
  if (c >= 0.4) return { bar: "from-amber-400 to-orange-400", text: "text-amber-300" };
  return { bar: "from-sky-400 to-blue-400", text: "text-sky-300" };
}