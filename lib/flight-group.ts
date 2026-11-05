import type { FlightRow } from "@/lib/flights";
import { needsAction } from "@/lib/flights";
import type { TFn } from "@/lib/i18n";

export type FlightGroup = { key: string; label: string; count: number; tone: "attn" | "day" | "stale"; rows: FlightRow[] };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Dates stay English and UTC (fixed rule): "Fri 04 Nov". */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
}
/** Short date for a card time: "04 Nov". */
export const dayShort = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)} ${MON[Number(iso.slice(5, 7)) - 1]}` : "");

/** Planned ground minutes (STD minus STA of the same turnaround). Only when both exist and it is not negative. */
export function plannedGround(r: { sta: string | null; std: string | null }): number | null {
  if (!r.sta || !r.std) return null;
  const m = Math.round((+new Date(r.std) - +new Date(r.sta)) / 60000);
  return m >= 0 ? m : null;
}

/**
 * Groups for the flights list. Nothing is hidden or reordered inside a group:
 * (1) flights that need the employee's action, (2) one group per UTC day (today / tomorrow / date),
 * (3) flights whose day has passed and are still not closed. The "done" tab has only day groups.
 */
export function groupFlights(rows: FlightRow[], tab: "active" | "done", t: TFn, now = Date.now()): FlightGroup[] {
  const today = new Date(now).toISOString().slice(0, 10);
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  const attn: FlightRow[] = [], stale: FlightRow[] = [], days = new Map<string, FlightRow[]>();
  for (const r of rows) {
    if (tab === "active" && needsAction(r)) { attn.push(r); continue; }
    if (tab === "active" && r.stale) { stale.push(r); continue; }
    const k = (r.sta ?? r.std ?? "").slice(0, 10) || "none";
    days.set(k, [...(days.get(k) ?? []), r]);
  }
  const out: FlightGroup[] = [];
  if (attn.length) out.push({ key: "attn", label: t("fl.grp.attn"), count: attn.length, tone: "attn", rows: attn });
  for (const [k, rs] of days) {
    const label = k === "none" ? t("fl.grp.undated") : k === today ? `${t("fl.grp.today")} · ${dayLabel(k)}` : k === tomorrow ? `${t("fl.grp.tomorrow")} · ${dayLabel(k)}` : dayLabel(k);
    out.push({ key: k, label, count: rs.length, tone: "day", rows: rs });
  }
  if (stale.length) out.push({ key: "stale", label: t("fl.grp.stale"), count: stale.length, tone: "stale", rows: stale });
  return out;
}
