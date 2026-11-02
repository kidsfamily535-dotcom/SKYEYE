import { translate, type Lang } from "@/lib/i18n";

/** Codes and times stay English and UTC (fixed rule). */
export const fmtUtc = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");

/** Hours from the database -> a short Arabic phrase. Never invents a number: null stays "—". */
export function hoursPhrase(h: number | null | undefined, lang: Lang = "ar"): string {
  if (h === null || h === undefined) return "—";
  const a = Math.abs(h);
  return a < 48 ? translate(lang, "fmt.hours", { n: Math.round(a * 10) / 10 }) : translate(lang, "fmt.days", { n: Math.round(a / 24) });
}
