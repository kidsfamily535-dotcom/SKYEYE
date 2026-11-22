import { durText } from "@/lib/dur";
import type { Lang, TFn } from "@/lib/i18n";

/** Labels the one-sentence flight status needs. Built once on the server and passed to client components as plain strings. */
export const lineLabels = (t: TFn) => ({
  sCancelled: t("fx.s.cancelled"), sDeparted: t("fx.s.departed"), sOnGround: t("fx.s.onGround"), sGroundLeft: t("fx.s.groundLeft"), sGroundOver: t("fx.s.groundOver"),
  sDelayed: t("fx.s.delayed"), sDelayedPlain: t("fx.s.delayedPlain"), sOnTime: t("fx.s.onTime"), sNoUpdate: t("fx.s.noUpdate"), sNoUpdate0: t("fx.s.noUpdate0"),
  sArrIn: t("fx.s.arrIn"), sUnknown: t("fx.s.unknown"), sDue: t("fx.s.due"),
});
export type LineLabels = ReturnType<typeof lineLabels>;

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const hm = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));

export type LineInput = { code: string; sta: number | null; eta: number | null; arr: number | null; dep: number | null; atd: number | null; dueType?: string | null; dueNow?: boolean };

/** ONE sentence that says where the flight stands. Replaces the status + reason + level badges. Nothing is guessed: only recorded or scheduled times are used. */
export function flightLine(r: LineInput, now: number, lang: Lang, S: LineLabels, compact = false): string {
  const d = (m: number) => durText(m, lang, compact);
  let s: string;
  switch (r.code) {
    case "cancelled": s = S.sCancelled; break;
    case "departed": s = fill(S.sDeparted, { t: hm(r.atd ?? r.dep) }); break;
    case "onGround": s = r.dep === null ? S.sOnGround : r.dep >= now ? fill(S.sGroundLeft, { d: d((r.dep - now) / 60000) }) : fill(S.sGroundOver, { d: d((now - r.dep) / 60000) }); break;
    case "delayed": { const m = r.eta !== null && r.sta !== null ? (r.eta - r.sta) / 60000 : 0; s = m > 0 ? fill(S.sDelayed, { d: d(m) }) : S.sDelayedPlain; break; }
    case "onTime": s = S.sOnTime; break;
    case "noUpdate": s = r.sta !== null ? fill(S.sNoUpdate, { d: d((now - r.sta) / 60000) }) : S.sNoUpdate0; break;
    case "soon": case "scheduled": s = r.arr !== null && r.arr > now ? fill(S.sArrIn, { d: d((r.arr - now) / 60000) }) : S.sUnknown; break;
    default: s = S.sUnknown;
  }
  return r.dueNow && r.dueType ? `${s} · ${fill(S.sDue, { type: r.dueType })}` : s;
}
