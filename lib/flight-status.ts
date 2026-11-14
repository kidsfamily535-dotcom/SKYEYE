import type { FlightRow } from "@/lib/flights";
import type { TFn } from "@/lib/i18n";

export type CardStatus = { tone: "ok" | "info" | "warn" | "late" | "idle"; code: "cancelled" | "departed" | "onGround" | "delayed" | "onTime" | "soon" | "noUpdate" | "scheduled" | "unknown"; label: string; sub?: string };

/** A status is only claimed when there is evidence for it (ETA event, actual time, recorded status). Otherwise: no update. */
export function cardStatus(r: FlightRow, t: TFn, now = Date.now()): CardStatus {
  if (r.status === "cancelled") return { tone: "late", code: "cancelled", label: t("fl.cs.cancelled") };
  if (r.atd) return { tone: "ok", code: "departed", label: t("fl.cs.departed") };
  if (r.ata) return { tone: "info", code: "onGround", label: t("fl.cs.onGround") };
  const sta = r.sta ? +new Date(r.sta) : null; const eta = r.eta ? +new Date(r.eta) : null;
  if (eta !== null && sta !== null) {
    const diff = Math.round((eta - sta) / 60000);
    return diff > 0 ? { tone: "late", code: "delayed", label: t("fl.cs.delayed"), sub: t("fl.cs.sub.late", { n: diff }) } : { tone: "ok", code: "onTime", label: t("fl.cs.onTime") };
  }
  if (r.status === "delayed") return { tone: "late", code: "delayed", label: t("fl.cs.delayed") };
  if (sta !== null) {
    const mins = Math.round((sta - now) / 60000);
    if (mins > 0 && mins <= 60) return { tone: "info", code: "soon", label: t("fl.cs.soon"), sub: t("fl.cs.sub.in", { n: mins }) };
    if (mins <= 0) return { tone: "warn", code: "noUpdate", label: t("fl.cs.noUpdate"), sub: t("fl.cs.sub.past") };
    return { tone: "idle", code: "scheduled", label: t("fl.cs.scheduled") };
  }
  return { tone: "idle", code: "unknown", label: t("fl.cs.unknown") };
}
