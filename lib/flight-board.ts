import type { FlightRow } from "@/lib/flights";
import { needsAction } from "@/lib/flights";
import { cardStatus } from "@/lib/flight-status";
import { dayLabel, plannedGround } from "@/lib/flight-group";
import type { TFn } from "@/lib/i18n";

/** Plain, serialisable row for the client board (no functions, no server imports on the client side). */
export type BoardRow = {
  id: string; href: string; flightIn: string | null; flightOut: string | null; reg: string | null;
  origin: string | null; station: string | null; dest: string | null;
  airlineCode: string; airlineName: string; logoUrl: string | null;
  sta: number | null; std: number | null; eta: number | null; ata: number | null; atd: number | null;
  arr: number | null; dep: number | null; ground: number | null;
  tone: "ok" | "info" | "warn" | "late" | "idle"; code: string; label: string; sub: string | null;
  attn: boolean; level: string | null; alerts: number; dueType: string | null; dueNow: boolean;
  stepsTotal: number; stepsDone: number; critical: number;
  dayKey: string; dayLabel: string;
};

const ms = (s: string | null) => (s ? +new Date(s) : null);

export function toBoardRows(rows: FlightRow[], tab: "active" | "done", t: TFn, now = Date.now()): BoardRow[] {
  return rows.map((r) => {
    const s = cardStatus(r, t, now);
    const arr = ms(r.ata ?? r.eta ?? r.sta); const dep = ms(r.atd ?? r.std);
    const dk = (r.sta ?? r.std ?? "").slice(0, 10);
    return {
      id: r.rotationId, href: `/flights?id=${r.rotationId}${tab === "done" ? "&tab=done" : ""}`,
      flightIn: r.flightIn, flightOut: r.flightOut, reg: r.registration, origin: r.origin, station: r.station, dest: r.destination,
      airlineCode: r.airline?.code ?? "—", airlineName: r.airline?.name ?? r.airline?.code ?? "—", logoUrl: r.airline?.logoUrl ?? null,
      sta: ms(r.sta), std: ms(r.std), eta: ms(r.eta), ata: ms(r.ata), atd: ms(r.atd), arr, dep, ground: plannedGround(r),
      tone: s.tone, code: s.code, label: s.label, sub: s.sub ?? null,
      attn: needsAction(r), level: r.attn?.level ?? null, alerts: r.attn?.alerts ?? 0,
      dueType: r.attn?.due ? r.attn.due.type.replace(/^MVT-/, "") : null, dueNow: !!r.attn?.due?.isDue,
      stepsTotal: r.stepsTotal ?? 0, stepsDone: r.stepsRecorded ?? 0, critical: r.criticalOpen ?? 0,
      dayKey: dk || "none", dayLabel: dk ? dayLabel(dk) : "—",
    };
  });
}
