/** Codes and times stay English and UTC (fixed rule). */
export const fmtUtc = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");

/** "HH:MM" in UTC, or "—". */
export const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

/** Short date+time for lists ("11-01 14:30 UTC"), or empty. */
export const fmtShort = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(5, 16).replace("T", " ") + " UTC" : "");

/** A count that may be unknown: null/undefined stays "—", never 0. */
export const dash = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(n));

/** Hours from the database -> a short Arabic phrase. Never invents a number: null stays "—". */
export function hoursPhrase(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  const a = Math.abs(h);
  const span = a < 48 ? `${Math.round(a * 10) / 10} ساعة` : `${Math.round(a / 24)} يوم`;
  return span;
}
