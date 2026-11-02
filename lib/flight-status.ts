import type { FlightRow } from "@/lib/flights";

export type CardStatus = { tone: "ok" | "info" | "warn" | "late" | "idle"; label: string; sub?: string };

/** A status is only claimed when there is evidence for it (ETA event, actual time, recorded status). Otherwise: no update. */
export function cardStatus(r: FlightRow, now = Date.now()): CardStatus {
  if (r.status === "cancelled") return { tone: "late", label: "ملغاة" };
  if (r.atd) return { tone: "ok", label: "غادرت" };
  if (r.ata) return { tone: "info", label: "على الأرض" };
  const sta = r.sta ? +new Date(r.sta) : null; const eta = r.eta ? +new Date(r.eta) : null;
  if (eta !== null && sta !== null) {
    const diff = Math.round((eta - sta) / 60000);
    return diff > 0 ? { tone: "late", label: "متأخرة", sub: `${diff} دقيقة عن STA` } : { tone: "ok", label: "على الموعد" };
  }
  if (r.status === "delayed") return { tone: "late", label: "متأخرة" };
  if (sta !== null) {
    const mins = Math.round((sta - now) / 60000);
    if (mins > 0 && mins <= 60) return { tone: "info", label: "قادمة قريباً", sub: `بعد ${mins} دقيقة` };
    if (mins <= 0) return { tone: "warn", label: "لا تحديث", sub: "تجاوزت وقت الوصول المجدول" };
    return { tone: "idle", label: "مجدولة" };
  }
  return { tone: "idle", label: "غير محدد" };
}

export function summarize(rows: FlightRow[], now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  let late = 0, ok = 0, soon = 0;
  for (const r of rows) { const s = cardStatus(r, now); if (s.tone === "late") late++; else if (s.label === "على الموعد") ok++; else if (s.label === "قادمة قريباً") soon++; }
  return { today: rows.filter((r) => (r.sta ?? r.std ?? "").slice(0, 10) === today).length, ok, late, soon };
}
