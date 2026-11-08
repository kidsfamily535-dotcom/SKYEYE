import type { ReactNode } from "react";
import type { TFn } from "@/lib/i18n";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const mins = (a: string, b: string) => Math.round((+new Date(a) - +new Date(b)) / 60000);

export type OtpInput = {
  ata: string | null; atd: string | null; std: string | null; expectedStd: string | null;
  /** المخطط من الجدول (STD − STA). ليس SLA معتمداً من عقد. null = غير محدد. */
  plannedGroundMin: number | null; now: number;
};

type Tone = "ok" | "info" | "warn" | "late";

/** كتلة OTP: زمن الأرض المخطط من الجدول، المنقضي منذ الوصول (ATA)، المتبقي، الإقلاع المستهدف. بعد الإقلاع: النتيجة. لا رقم يُخترع. */
export default function OtpBlock({ o, t, delayAction }: { o: OtpInput; t: TFn; delayAction?: ReactNode }) {
  const { ata, atd, std, expectedStd, plannedGroundMin: plan, now } = o;
  const target = expectedStd ?? std;
  const nowIso = new Date(now).toISOString();

  // بعد الإقلاع: النتيجة فقط
  if (atd && std) {
    const late = mins(atd, std);
    return (
      <section className={`card otp ${late > 0 ? "warn" : "ok"}`} aria-label={t("fl.otp.title")}>
        <h2>{t("fl.otp.title")}</h2>
        <p className="otp-result"><b>{late > 0 ? t("fl.otp.lateBy", { n: late }) : t("fl.otp.onTime")}</b></p>
        <dl className="otp-cells"><div><dt>{t("fl.j.std")}</dt><dd className="ltr">{hm(std)}</dd></div><div><dt>{t("fl.j.actual")}</dt><dd className="ltr"><b>{hm(atd)}</b></dd></div></dl>
        {late > 0 && delayAction}
      </section>
    );
  }

  const planKnown = plan !== null && plan > 0;
  const elapsed = ata ? Math.max(0, mins(nowIso, ata)) : null;
  const left = planKnown && elapsed !== null ? plan - elapsed : null;
  const tone: Tone = !ata ? "ok" : left === null ? "info" : left < 0 ? "late" : left <= 10 ? "warn" : "ok";
  const depLate = target && std ? mins(target, std) : 0;

  return (
    <section className={`card otp ${tone}`} aria-label={t("fl.otp.title")}>
      <h2>{t("fl.otp.title")}</h2>
      {!ata && <p className="muted">{t("fl.otp.waitArrival")}</p>}
      <dl className="otp-cells">
        <div><dt>{t("fl.otp.planned")}</dt><dd className="ltr">{planKnown ? t("fl.min", { n: plan }) : t("fl.otp.unknown")}</dd></div>
        <div><dt>{t("fl.otp.elapsed")}</dt><dd className="ltr">{elapsed !== null ? t("fl.min", { n: elapsed }) : "—"}</dd></div>
        <div><dt>{t("fl.otp.left")}</dt><dd className="ltr"><b>{left !== null ? (left < 0 ? t("fl.otp.over", { n: -left }) : t("fl.min", { n: left })) : "—"}</b></dd></div>
        <div><dt>{t("fl.otp.target")}</dt><dd className="ltr">{hm(target)}</dd></div>
      </dl>
      <small className="muted">{t("fl.otp.basis")}</small>
      {depLate > 0 && delayAction}
    </section>
  );
}
