/** Codes and times stay English and UTC (fixed rule). */
export const fmtUtc = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");

/** Hours from the database -> a short Arabic phrase. Never invents a number: null stays "—". */
export function hoursPhrase(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  const a = Math.abs(h);
  const span = a < 48 ? `${Math.round(a * 10) / 10} ساعة` : `${Math.round(a / 24)} يوم`;
  return span;
}
