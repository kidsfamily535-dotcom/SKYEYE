import type { StepRow } from "@/lib/flights";

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
export function buildJourney(f: Raw, clock: Raw, steps: StepRow[], now = Date.now()): Journey {
  const cancelled = f.status === "cancelled";
  const at = (k: string) => (f[k] ? String(f[k]) : null);
  const sta = at("sta"), std = at("std"), eta = at("eta"), ata = at("ata"), atd = at("atd");
  const expected = clock.expected_std ? String(clock.expected_std) : null;

  const idx = atd ? 2 : ata ? 1 : 0;
  const phases = [["pre", "قبل الوصول"], ["ground", "على الأرض"], ["gone", "غادرت"]].map(([key, label], i) => ({ key, label, state: (i < idx ? "done" : i === idx ? (atd ? "done" : "current") : "todo") as "done" | "current" | "todo" }));

  // الوصول
  const arrVar = ata ? diff(ata, sta) : eta ? diff(eta, sta) : null;
  const arrLevel: Level = ata ? "ok" : eta && (arrVar ?? 0) > 0 ? "warn" : levelFor(eta ?? sta, now);
  const arrival: JourneyRow = {
    id: "arrival", name: "الوصول", code: "ARR", critical: false, scheduled: sta, predicted: eta, target: null, actual: ata,
    variance: arrVar, varianceKind: ata ? "actual" : eta ? "predicted" : null, level: arrLevel,
    status: ata ? "وصلت" : arrLevel === "late" ? "لا تحديث بعد الموعد" : eta && (arrVar ?? 0) > 0 ? "وصول متوقع متأخر" : "بانتظار الوصول",
  };

  // المغادرة
  const depVar = atd ? diff(atd, std) : expected ? diff(expected, std) : null;
  const depLevel: Level = atd ? "ok" : expected && (depVar ?? 0) > 0 ? (levelFor(expected, now) === "late" ? "late" : "warn") : levelFor(expected ?? std, now);
  const departure: Departure = {
    std, expected, atd, variance: depVar, level: depLevel,
    headline: atd ? ((depVar ?? 0) > 0 ? `غادرت بتأخير ${depVar} د` : "غادرت في الموعد") : expected ? ((depVar ?? 0) > 0 ? `احتمال تأخير ${depVar} د` : "على الموعد") : "لا توقع للمغادرة بعد",
    action: atd ? null : !expected ? "يظهر التوقع بعد تسجيل الوصول." : (depVar ?? 0) > 0 ? "راجع الخدمات المتبقية وأكّد موعد جاهزية الطائرة." : null,
  };
  const depRow: JourneyRow = {
    id: "departure", name: "المغادرة", code: "DEP", critical: false, scheduled: std, predicted: expected, target: null, actual: atd,
    variance: depVar, varianceKind: atd ? "actual" : expected ? "predicted" : null, level: depLevel,
    status: atd ? "غادرت" : expected ? ((depVar ?? 0) > 0 ? "احتمال تأخير" : "على الموعد") : "لا توقع بعد",
  };

  // المراحل: المسجّلة، أو التي لها قالب معتمد ووقت مخطط. ATA وATD يظهران في صفّي الوصول والمغادرة.
  const mid: JourneyRow[] = steps
    .filter((s) => !/^(ATA|ATD)$/i.test(s.code) && (s.state === "recorded" || (s.plannedAt && s.templateStatus === "approved")))
    .map((s) => {
      const rec = s.state === "recorded";
      const level: Level = rec ? ((s.variance ?? 0) > 0 ? "warn" : "ok") : levelFor(s.plannedAt, now);
      return {
        id: `${s.track}-${s.code}`, name: s.nameAr, code: s.code, critical: s.isCritical, scheduled: null, predicted: null, target: s.plannedAt, actual: s.actualAt,
        variance: s.variance, varianceKind: rec && s.variance !== null ? "actual" as const : null, level,
        status: rec ? (s.wasCorrected ? "سُجّل · مصحَّح" : "سُجّل") : s.state === "open" ? "الوكيل ينتظر ردك" : level === "late" ? "تجاوز الموعد ولم يُسجَّل" : "قادم",
      };
    })
    .sort((a, b) => +new Date(a.actual ?? a.target ?? 0) - +new Date(b.actual ?? b.target ?? 0));

  const rows = [arrival, ...mid, depRow];
  const overall = cancelled ? "late" : worst(rows.filter((r) => !r.actual).map((r) => r.level));
  return { phases, cancelled, departure, rows, overall };
}

export const LEVEL_AR: Record<Level, string> = { ok: "ضمن الوقت", info: "إجراء قريب", warn: "خطر تجاوز", late: "تجاوز أو تدخل فوري" };
