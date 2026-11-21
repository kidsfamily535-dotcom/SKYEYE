import type { OtpState, OtpStep } from "@/lib/otp";

// Radar-style stand panel: handling start / expected departure / handling end, then one line per service on a shared time axis.
// Dashed tick = planned end, solid = what was recorded, red = past plan. Nothing is guessed: a service with no recorded start shows only its end marker.

const COLOR: Record<string, string> = { deboard: "#5B9DFF", bags_unload: "#B18CFF", bags_load: "#B18CFF", cleaning: "#35C2C2", catering: "#FF8A5B", fuel: "#E9E9E9", doors_closed: "#8A97A6", off_block: "#8A97A6" };
const colorOf = (code: string) => (code.startsWith("boarding") ? "#FFC107" : COLOR[code] ?? "#A3A3A3");
const ms = (s: string | null | undefined) => (s ? +new Date(s) : null);
const hm = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));

export default function OtpGantt({ otp, nowMs, lang, title }: { otp: OtpState; nowMs: number; lang: "ar" | "en"; title?: string }) {
  const ar = lang === "ar";
  if (otp.status !== "ok") return <p className="rd-empty">{ar ? "لا يوجد دوران مفتوح لهذه الرحلة بعد." : "No open turn for this flight yet."}</p>;
  const { snapshot: sn, names } = otp;
  const steps = sn.steps.filter((s) => s.step_code !== "ground_start");
  const acgt = ms(sn.turn.in_block_at);
  const expDep = ms(sn.ground.projected_off_block ?? sn.ground.target_departure);
  const planDep = ms(sn.ground.original_std ?? sn.turn.std);
  const off = steps.find((s) => s.step_code === "off_block");
  const aegt = ms(off?.actual_end);

  const pts = [acgt, expDep, planDep, aegt, nowMs, ...steps.flatMap((s) => [ms(s.planned_end), ms(s.expected_end), ms(s.actual_end), ms(s.actual_start)])].filter((v): v is number => v !== null);
  const t0 = Math.min(acgt ?? Infinity, ...pts) - 5 * 60000; const t1 = Math.max(...pts) + 5 * 60000;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - t0) / (t1 - t0)) * 100)).toFixed(2)}%`;
  const late = expDep !== null && planDep !== null && expDep - planDep >= 60000;
  const nm = (s: OtpStep) => names[s.step_code] ?? s.step_name_ar ?? s.step_code;
  const delayTxt = (s: OtpStep) => { const m = s.late_vs_plan_min; if (s.step_state === "upcoming" || m === null) return null; return m >= 3 ? `+${m} ${ar ? "د" : "m"}` : (ar ? "في الوقت" : "on time"); };

  return (
    <div className="rd-stand">
      {title && <h2 className="rd-h">{title}</h2>}
      <div className="rd-trio">
        <div><small>{ar ? "بداية المناولة" : "Handling start"}</small><b className="ltr">{hm(acgt)} <em>ACGT</em></b></div>
        <div><small>{ar ? "الإقلاع المتوقع" : "Expected departure"}</small><b className={`ltr ${late ? "bad" : ""}`}>{hm(expDep)} <em>TOBT</em></b></div>
        <div><small>{ar ? "نهاية المناولة" : "Handling end"}</small><b className="ltr">{hm(aegt)} <em>AEGT</em></b></div>
      </div>
      <div className="rd-gantt" role="img" aria-label={ar ? "الخط الزمني للخدمات" : "Service timeline"}>
        <div className="rd-g-axis"><span /><div className="ltr">
          <i style={{ left: pct(t0 + 5 * 60000) }}>{hm(t0 + 5 * 60000)}</i>
          {planDep !== null && <i className="plan" style={{ left: pct(planDep) }}>{hm(planDep)}</i>}
          <i className="now" style={{ left: pct(nowMs) }}>{hm(nowMs)}</i>
        </div></div>
        {steps.map((s) => {
          const a0 = ms(s.actual_start); const a1 = ms(s.actual_end) ?? ms(s.expected_end); const pe = ms(s.planned_end);
          const dt = delayTxt(s); const bad = (s.late_vs_plan_min ?? 0) >= 3 || s.step_state === "overdue_unconfirmed";
          const c = colorOf(s.step_code);
          return (
            <div className="rd-g-row" key={s.step_code}>
              <div className="rd-g-name"><b>{nm(s)}</b>{dt && <span className={bad ? "bad" : "good"}>{dt}</span>}</div>
              <div className="rd-g-track ltr">
                {planDep !== null && <u className="plan-line" style={{ left: pct(planDep) }} />}
                <u className="now-line" style={{ left: pct(nowMs) }} />
                {pe !== null && <s className="plan-tick" style={{ left: pct(pe), borderColor: c }} />}
                {a0 !== null && a1 !== null && <span className={`bar ${s.step_state === "done" || s.step_state === "done_late" ? "" : "live"}`} style={{ left: pct(a0), width: `calc(${pct(a1)} - ${pct(a0)})`, background: bad ? "#FF766C" : c, minWidth: 6 }} />}
                {a0 === null && ms(s.actual_end) !== null && <span className="dot" style={{ left: pct(ms(s.actual_end) as number), background: bad ? "#FF766C" : c }} />}
              </div>
            </div>
          );
        })}
      </div>
      <p className={`rd-foot ${late ? "bad" : ""}`}>{expDep !== null ? (ar ? `إقلاع متوقع ${hm(expDep)}${planDep !== null && late ? ` (+${Math.round((expDep - planDep) / 60000)} د)` : ""}` : `Expected departure ${hm(expDep)}`) : (ar ? "الإقلاع المتوقع غير محسوب بعد" : "Expected departure not computed yet")}</p>
      <p className="rd-legend">{ar ? "متقطع = المخطط · مصمت = المسجَّل · أحمر = تجاوز" : "Dashed = planned · solid = recorded · red = over plan"}</p>
    </div>
  );
}
