import { stepName, type StepRow } from "@/lib/flights";
import type { Lang, TFn } from "@/lib/i18n";

/** أخضر: ضمن الوقت · أزرق: إجراء قريب · برتقالي: خطر تجاوز · أحمر: تجاوز المهلة */
export type Level = "ok" | "info" | "warn" | "late";

/**
 * نوافذ عرض فقط لتلوين الحدث الذي لم يُسجَّل بعد، وليست SLA معتمداً.
 * لا يوجد في القاعدة مهل معتمدة (القوالب draft)، فالمالك يضبط هذين الرقمين عند اعتماد المهل.
 */
export const WINDOW_BLUE_MIN = 30;
export const WINDOW_ORANGE_MIN = 10;

type Raw = Record<string, any>;

export type JourneyRow = {
  id: string; name: string; code: string | null; critical: boolean;
  scheduled: string | null; predicted: string | null; target: string | null; actual: string | null;
  variance: number | null; varianceKind: "actual" | "predicted" | null;
  level: Level; status: string;
};
export type Departure = {
  std: string | null; expected: string | null; atd: string | null;
  variance: number | null; level: Level; headline: string; action: string | null;
};
export type Journey = {
  phases: { key: string; label: string; state: "done" | "current" | "todo" }[];
  cancelled: boolean; departure: Departure; rows: JourneyRow[]; overall: Level;
};

const diff = (a: string | null | undefined, b: string | null | undefined) => (a && b ? Math.round((+new Date(a) - +new Date(b)) / 60000) : null);
const ORDER: Level[] = ["ok", "info", "warn", "late"];
const worst = (xs: Level[]): Level => xs.reduce<Level>((m, x) => (ORDER.indexOf(x) > ORDER.indexOf(m) ? x : m), "ok");

/** مستوى حدث لم يقع بعد حسب القرب من موعده. */
export function levelFor(at: string | null | undefined, now: number): Level {
  if (!at) return "ok";
  const m = (+new Date(at) - now) / 60000;
  if (m < 0) return "late";
  if (m <= WINDOW_ORANGE_MIN) return "warn";
  if (m <= WINDOW_BLUE_MIN) return "info";
  return "ok";
}

/** كل ما هنا مأخوذ من بيانات مسجّلة أو محسوبة في القاعدة. لا وقت ولا سبب يُخمَّن. */
export function buildJourney(f: Raw, clock: Raw, steps: StepRow[], t: TFn, lang: Lang, now = Date.now()): Journey {
  const cancelled = f.status === "cancelled";
  const at = (k: string) => (f[k] ? String(f[k]) : null);
  const sta = at("sta"), std = at("std"), eta = at("eta"), ata = at("ata"), atd = at("atd");
  const expected = clock.expected_std ? String(clock.expected_std) : null;

  const idx = atd ? 2 : ata ? 1 : 0;
  const phases = [["pre", t("fl.j.phase.pre")], ["ground", t("fl.j.phase.ground")], ["gone", t("fl.j.phase.gone")]].map(([key, label], i) => ({ key, label, state: (i < idx ? "done" : i === idx ? (atd ? "done" : "current") : "todo") as "done" | "current" | "todo" }));

  // الوصول
  const arrVar = ata ? diff(ata, sta) : eta ? diff(eta, sta) : null;
  const arrLevel: Level = ata ? "ok" : eta && (arrVar ?? 0) > 0 ? "warn" : levelFor(eta ?? sta, now);
  const arrival: JourneyRow = {
    id: "arrival", name: t("fl.j.arrival"), code: "ARR", critical: false, scheduled: sta, predicted: eta, target: null, actual: ata,
    variance: arrVar, varianceKind: ata ? "actual" : eta ? "predicted" : null, level: arrLevel,
    status: ata ? t("fl.j.st.arrived") : arrLevel === "late" ? t("fl.j.st.noUpdate") : eta && (arrVar ?? 0) > 0 ? t("fl.j.st.arrLate") : t("fl.j.st.arrWait"),
  };

  // المغادرة
  const depVar = atd ? diff(atd, std) : expected ? diff(expected, std) : null;
  const depLevel: Level = atd ? "ok" : expected && (depVar ?? 0) > 0 ? (levelFor(expected, now) === "late" ? "late" : "warn") : levelFor(expected ?? std, now);
  const departure: Departure = {
    std, expected, atd, variance: depVar, level: depLevel,
    headline: atd ? ((depVar ?? 0) > 0 ? t("fl.j.h.lateDep", { n: depVar ?? 0 }) : t("fl.j.h.onTimeDep")) : expected ? ((depVar ?? 0) > 0 ? t("fl.j.h.risk", { n: depVar ?? 0 }) : t("fl.j.h.onTime")) : t("fl.j.h.none"),
    action: atd ? null : !expected ? t("fl.j.a.afterArrival") : (depVar ?? 0) > 0 ? t("fl.j.a.review") : null,
  };
  const depRow: JourneyRow = {
    id: "departure", name: t("fl.j.departure"), code: "DEP", critical: false, scheduled: std, predicted: expected, target: null, actual: atd,
    variance: depVar, varianceKind: atd ? "actual" : expected ? "predicted" : null, level: depLevel,
    status: atd ? t("fl.j.st.departed") : expected ? ((depVar ?? 0) > 0 ? t("fl.j.st.depRisk") : t("fl.j.st.onTime")) : t("fl.j.st.noForecast"),
  };

  // المراحل: المسجّلة، أو التي لها قالب معتمد ووقت مخطط. ATA وATD يظهران في صفّي الوصول والمغادرة.
  const mid: JourneyRow[] = steps
    .filter((s) => !/^(ATA|ATD)$/i.test(s.code) && (s.state === "recorded" || (s.plannedAt && s.templateStatus === "approved")))
    .map((s) => {
      const rec = s.state === "recorded";
      const level: Level = rec ? ((s.variance ?? 0) > 0 ? "warn" : "ok") : levelFor(s.plannedAt, now);
      return {
        id: `${s.track}-${s.code}`, name: stepName(s, lang), code: s.code, critical: s.isCritical, scheduled: null, predicted: null, target: s.plannedAt, actual: s.actualAt,
        variance: s.variance, varianceKind: rec && s.variance !== null ? "actual" as const : null, level,
        status: rec ? (s.wasCorrected ? t("fl.j.st.recCorr") : t("fl.j.st.rec")) : s.state === "open" ? t("fl.j.st.open") : level === "late" ? t("fl.j.st.missed") : t("fl.j.st.upcoming"),
      };
    })
    .sort((a, b) => +new Date(a.actual ?? a.target ?? 0) - +new Date(b.actual ?? b.target ?? 0));

  const rows = [arrival, ...mid, depRow];
  const overall = cancelled ? "late" : worst(rows.filter((r) => !r.actual).map((r) => r.level));
  return { phases, cancelled, departure, rows, overall };
}

/** Translation key for a level label: t(LEVEL_KEY[level]). */
export const LEVEL_KEY = { ok: "fl.lv.ok", info: "fl.lv.info", warn: "fl.lv.warn", late: "fl.lv.late" } as const;
