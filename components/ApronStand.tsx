"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import type { OtpDelay, OtpState, OtpStep } from "@/lib/otp";
import { LAYOUT, FALLBACK } from "@/lib/otp-layout";
import { BOX, CX, CY, MAP_H, MAP_W, PLANE, TAXI_Y, VEH_COLOR, apronText, colorOf, vehOf } from "@/lib/apron";

// The apron scene: the aircraft is watched on the ground the way it is watched in the air.
// One component for both products: SKYEYE staff (recording controls come in through `stepPanel` / `prePanel`)
// and Airline Eye (view only: it simply passes none, and `calm` swaps red for amber).
// It never calls a server action and invents no number: everything is drawn from otp_turn_state (lib/otp.ts).

type Ok = Extract<OtpState, { status: "ok" }>;
export type ApronTone = "ok" | "warn" | "late" | "muted";

export type ApronProps = {
  otp: OtpState;
  lang: Lang;
  tone: ApronTone;
  /** Airline view: amber instead of red, nobody is blamed. */
  calm?: boolean;
  /** Big counter / final sentence drawn over the map. */
  head: ReactNode;
  /** Flight and registration, small, top corner of the map. */
  idLabel: string;
  badge?: ReactNode;
  sel: string | null;
  onSel: (code: string | null) => void;
  /** Status word of a service (wording differs between the two products). */
  tag: (s: OtpStep) => string;
  /** Extra content inside the opened service card (SKYEYE staff: record end/start, delay reason). */
  stepPanel?: (s: OtpStep, ctx: { late: boolean; delay?: OtpDelay }) => ReactNode;
  /** Content under the map before the aircraft is on the stand (open the turn / set chocks-on). */
  prePanel?: ReactNode;
  showDelays?: boolean;
  showLog?: boolean;
};

const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const ms = (iso: string | null | undefined) => (iso ? +new Date(iso) : null);
const hmMs = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));
const own = (s: OtpStep) => (s.own_delay_min ?? 0) + (s.start_delay_min ?? 0);
const isLate = (s: OtpStep) => s.step_state === "overdue_unconfirmed" || ((s.step_state === "in_window" || s.step_state === "done_late") && (s.late_vs_plan_min ?? 0) >= 3);
const running = (s: OtpStep) => s.step_state === "in_window" || s.step_state === "overdue_unconfirmed";

export default function ApronStand({ otp, lang, tone, calm, head, idLabel, badge, sel, onSel, tag, stepPanel, prePanel, showDelays = true, showLog = true }: ApronProps) {
  const T = apronText(lang);
  const dl = (n: number) => <><bdi className="ltr">+{n}</bdi> <span className="ap-u">{T("min")}</span></>;
  const router = useRouter();
  const [nowMs, setNowMs] = useState<number | null>(null);

  const ok: Ok | null = otp.status === "ok" ? otp : null;
  const phase: "approach" | "stand" | "left" = !ok ? "approach" : ok.snapshot.ground.state === "completed" ? "left" : ok.snapshot.ground.state === "awaiting_chocks_on" ? "approach" : "stand";
  const sta = ok ? ok.snapshot.turn.sta : otp.status === "no_turn" ? otp.sta : null;

  // Live while the aircraft is on the stand; stays quiet while offline so the last good view remains.
  useEffect(() => {
    setNowMs(Date.now());
    if (phase === "left") return;
    const clock = setInterval(() => setNowMs(Date.now()), 30000);
    const fresh = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) router.refresh(); }, 60000);
    return () => { clearInterval(clock); clearInterval(fresh); };
  }, [phase, router]);

  useEffect(() => {
    if (!sel) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onSel(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [sel, onSel]);

  const names = ok?.names ?? {};
  const steps = useMemo(() => ok?.snapshot.steps ?? [], [ok]);
  const delays = ok?.delays ?? [];
  const nm = (s: OtpStep) => names[s.step_code] ?? s.step_name_ar ?? s.step_code;
  const delayOf = (code: string) => [...delays].reverse().find((d) => d.milestone === code);
  const bad = calm ? "var(--ap-warn)" : "var(--ap-bad)";
  const boxColor = tone === "late" ? bad : tone === "warn" ? "var(--ap-warn)" : "rgba(255,255,255,.42)";

  /* ---------------- the map ---------------- */
  const vehicles = steps.map((s) => {
    const v = vehOf(s.step_code);
    if (!v) return null;
    const active = running(s);
    const picked = sel === s.step_code;
    if (!active && !picked) return null;
    const late = isLate(s);
    return (
      <g key={s.step_code} className={`ap-veh${active ? " run" : " ghost"}${late ? " late" : ""}${picked ? " sel" : ""}`} transform={`translate(${CX + v.dx} ${CY + v.dy})`} onClick={() => onSel(picked ? null : s.step_code)} role="button" tabIndex={0} aria-label={nm(s)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSel(picked ? null : s.step_code); }}>
        <title>{nm(s)}</title>
        <rect x={-10} y={-6.5} width={20} height={13} rx={3} fill={VEH_COLOR[v.kind]} />
        <rect className="ap-veh-ring" x={-14} y={-10.5} width={28} height={21} rx={5} />
      </g>
    );
  });

  const map = (
    <svg className="ap-map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={T("mapAria")} preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="ap-nz" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves={2} seed={4} /><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 -.1" /></filter>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="var(--ap-map)" />
      <rect width={MAP_W} height={MAP_H} filter="url(#ap-nz)" opacity={0.35} />
      <rect x={8} y={8} width={MAP_W - 16} height={252} rx={6} fill="var(--ap-apron)" opacity={0.92} />
      <rect x={22} y={12} width={MAP_W - 44} height={32} rx={4} fill="var(--ap-tx)" />
      <text x={CX} y={33} textAnchor="middle" className="ap-ml">{T("terminal")}</text>
      <line x1={CX} y1={44} x2={CX} y2={BOX.y + 24} stroke="var(--ap-tx)" strokeWidth={4} />
      <rect x={-20} y={TAXI_Y - 9} width={MAP_W + 40} height={18} fill="var(--ap-tx)" />
      <line x1={-20} y1={TAXI_Y} x2={MAP_W + 20} y2={TAXI_Y} stroke="#E5B800" strokeWidth={1.2} strokeDasharray="10 8" />
      <text x={14} y={TAXI_Y - 12} textAnchor="start" className="ap-ml sm">{T("taxiway")}</text>
      <path d={`M54 ${MAP_H - 18}V300H${MAP_W - 14}`} fill="none" stroke="var(--ap-tx)" strokeWidth={8} strokeLinejoin="round" />
      <text x={MAP_W - 10} y={296} textAnchor="end" className="ap-ml sm">{T("road")}</text>
      <rect x={12} y={MAP_H - 30} width={86} height={22} rx={4} fill="var(--ap-tx)" />
      <text x={55} y={MAP_H - 15} textAnchor="middle" className="ap-ml sm">{T("depot")}</text>

      <rect className={`ap-box${phase === "stand" ? " on" : ""}`} x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={5} style={{ stroke: boxColor }} />
      <text x={CX} y={BOX.y - 6} textAnchor="middle" className="ap-ml">{T("stand")}</text>

      {phase === "approach" && (
        <g>
          <path d={`M${MAP_W + 20} ${TAXI_Y}H${CX}V${BOX.y + BOX.h + 4}`} className="ap-path" />
          <g transform={`translate(${MAP_W - 84} ${TAXI_Y}) rotate(-90) scale(1.15)`}><path d={PLANE} className="ap-plane ghost" /></g>
          <text x={MAP_W - 84} y={TAXI_Y - 34} textAnchor="middle" className="ap-ml"><tspan>{T("inbound")}</tspan><tspan dx={6} className="ltr">{hm(sta)}</tspan></text>
        </g>
      )}
      {phase === "stand" && (
        <g transform={`translate(${CX} ${CY})`}><g className="ap-land"><g transform="scale(1.6)"><path d={PLANE} className={`ap-plane${tone === "late" ? " late" : ""}`} /></g></g></g>
      )}
      {phase === "left" && (
        <g>
          <g transform={`translate(112 ${TAXI_Y}) rotate(-90) scale(.95)`}><path d={PLANE} className="ap-plane gone" /></g>
          <text x={112} y={TAXI_Y - 30} textAnchor="middle" className="ap-ml">{T("left")}</text>
        </g>
      )}
      {phase === "stand" && vehicles}
    </svg>
  );

  /* ---------------- the gantt ---------------- */
  const g = ok?.snapshot.ground;
  const acgt = ok ? ms(ok.snapshot.turn.in_block_at) : null;
  const gsteps = steps.filter((s) => s.step_code !== "ground_start");
  let gantt: ReactNode = null;
  if (ok && g && acgt !== null && phase !== "approach" && gsteps.length > 0) {
    const expDep = ms(g.projected_off_block ?? g.target_departure);
    const planDep = ms(g.original_std ?? ok.snapshot.turn.std);
    const pts = [acgt, expDep, planDep, phase === "stand" ? nowMs : null, ...gsteps.flatMap((s) => [ms(s.planned_end), ms(s.expected_end), ms(s.actual_end), ms(s.actual_start)])].filter((v): v is number => v !== null);
    const t0 = Math.min(...pts) - 3 * 60000; const t1 = Math.max(...pts) + 4 * 60000;
    const at = (v: number) => Math.max(0, Math.min(100, ((v - t0) / (t1 - t0)) * 100));
    const pc = (v: number) => `${at(v).toFixed(2)}%`;
    const ticks = [0, 1, 2, 3, 4].map((k) => t0 + ((t1 - t0) * k) / 4);
    const over = expDep !== null && planDep !== null && expDep - planDep >= 60000;
    const overMin = over ? Math.round(((expDep as number) - (planDep as number)) / 60000) : 0;
    const delayTxt = (s: OtpStep): ReactNode => { const m = s.late_vs_plan_min; if (s.step_state === "upcoming" || m === null) return null; return m >= 3 ? dl(m) : T("onTime"); };
    gantt = (
      <section className="ap-sec" aria-label={T("gantt")}>
        <h3 className="ap-h">{T("gantt")}</h3>
        <div className="ap-g ltr" role="img" aria-label={T("ganttAria")}>
          <div className="ap-g-axis">{ticks.map((v, k) => <i key={k} style={{ left: pc(v) }}>{hmMs(v)}</i>)}
            {phase === "stand" && nowMs !== null && <b className="ap-g-plane" style={{ left: pc(nowMs) }}><svg viewBox="-40 -40 80 80" width="24" height="24" aria-hidden="true"><path d={PLANE} transform="rotate(90)" fill="#FFC107" stroke="#000" strokeWidth={4} /></svg></b>}</div>
          <div className="ap-g-rows">
            <div className="ap-g-over" aria-hidden="true">
              {planDep !== null && <u className="ap-g-std" style={{ left: pc(planDep) }}><em>{T("std")} {hmMs(planDep)}</em></u>}
              {over && expDep !== null && <u className="ap-g-exp" style={{ left: pc(expDep) }}><em>{T("dep")} +{overMin}</em></u>}
              {phase === "stand" && nowMs !== null && <u className="ap-g-now" style={{ left: pc(nowMs) }} />}
            </div>
            {gsteps.map((s) => {
              const c = colorOf(s.step_code);
              const a0 = ms(s.actual_start); const ae = ms(s.actual_end); const pe = ms(s.planned_end);
              const end = ae ?? (running(s) && nowMs !== null ? nowMs : null);
              const late = isLate(s) || (s.late_vs_plan_min ?? 0) >= 3;
              const dt = delayTxt(s);
              return (
                <button type="button" key={s.step_code} className={`ap-g-row${sel === s.step_code ? " sel" : ""}`} onClick={() => onSel(sel === s.step_code ? null : s.step_code)} aria-pressed={sel === s.step_code}>
                  <span className="ap-g-name"><b dir="auto">{nm(s)}</b>{dt && <small className={late ? "bad" : "good"}>{dt}</small>}</span>
                  <span className="ap-g-track">
                    {pe !== null && <s className="ap-g-plan" style={{ left: pc(pe), borderColor: c }} />}
                    {a0 !== null && end !== null && <span className={`ap-g-bar${ae === null ? " live" : ""}`} style={{ left: pc(a0), width: `max(6px, calc(${pc(end)} - ${pc(a0)}))`, background: c }} />}
                    {a0 !== null && end !== null && pe !== null && end > pe && <span className={`ap-g-bar over${ae === null ? " live" : ""}`} style={{ left: pc(Math.max(a0, pe)), width: `max(4px, calc(${pc(end)} - ${pc(Math.max(a0, pe))}))` }} />}
                    {a0 === null && ae !== null && <span className={`ap-g-dot${late ? " over" : ""}`} style={{ left: pc(ae), background: late ? undefined : c }} />}
                    {a0 === null && ae === null && running(s) && nowMs !== null && <span className="ap-g-dot live" style={{ left: pc(nowMs), background: c }} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="ap-legend">{T("legend")} · {calm ? T("legendCalm") : T("legendBad")}</p>
      </section>
    );
  }

  /* ---------------- service cards ---------------- */
  const cards = ok && phase !== "approach" && gsteps.length > 0 && (
    <section className="ap-sec" aria-label={T("services")}>
      <h3 className="ap-h">{T("services")}<small className="ap-n ltr">{gsteps.length}</small></h3>
      <ol className="ap-cards">
        {gsteps.map((s, n) => {
          const late = isLate(s);
          const open = sel === s.step_code;
          const done = s.step_state === "done" || s.step_state === "done_late";
          const dly = delayOf(s.step_code);
          const icon = (LAYOUT[s.step_code] ?? FALLBACK).icon;
          const right: ReactNode = done ? (own(s) > 0 ? dl(own(s)) : T("onTime")) : late && (s.late_vs_plan_min ?? 0) >= 3 ? dl(s.late_vs_plan_min ?? 0) : null;
          return (
            <li key={s.step_code} className={`ap-card ${s.step_state}${late ? " late" : ""}${open ? " open" : ""}`}>
              <button type="button" className="ap-card-b" onClick={() => onSel(open ? null : s.step_code)} aria-expanded={open}>
                <span className="ap-ic" style={{ background: colorOf(s.step_code) }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg></span>
                <span className="ap-card-t"><b dir="auto">{n + 1}. {nm(s)}</b>
                  <small className="ltr">{done ? `${hm(s.actual_start ?? null) !== "—" ? `${hm(s.actual_start)} – ` : ""}${hm(s.actual_end)}` : `${T("planned")} ${hm(s.planned_end)}`}</small></span>
                <span className={`ap-pill ${s.step_state}${late ? " late" : ""}`}>{tag(s)}</span>
                {right && <span className={`ap-rt${late ? " bad" : ""}`}>{right}</span>}
              </button>
              {open && (
                <div className="ap-card-body">
                  <p className="ap-lines">
                    <span>{T("planned")} <b className="ltr">{hm(s.planned_end)}</b></span>
                    {done ? <span>{T("actual")} <b className="ltr">{hm(s.actual_end)}</b></span> : <span>{T("expected")} <b className="ltr">{hm(s.expected_end)}</b></span>}
                    {s.actual_start && <span>{T("started")} <b className="ltr">{hm(s.actual_start)}</b></span>}
                  </p>
                  {(late || (done && dly)) && <p className="ap-lines"><b>{T("reason")}:</b> {dly ? <bdi>{dly.reason}</bdi> : <span>{T("noReason")}</span>}</p>}
                  {stepPanel?.(s, { late, delay: dly })}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );

  /* ---------------- delays + log ---------------- */
  const lateNow = steps.filter((s) => s.step_code !== "ground_start" && (isLate(s) || s.step_state === "done_late"));
  const delaysBox = ok && showDelays && phase === "stand" && (
    <section className="ap-sec" aria-label={T("delays")}>
      <h3 className="ap-h">{T("delays")}</h3>
      {lateNow.length === 0 ? <p className="ap-none">{T("noDelays")}</p> : (
        <ul className="ap-list">
          {lateNow.map((s) => { const d = delayOf(s.step_code); const m = s.step_state === "done_late" ? own(s) : s.late_vs_plan_min ?? 0; return (
            <li key={s.step_code}><button type="button" onClick={() => onSel(s.step_code)}><b dir="auto">{nm(s)}</b><span className="ap-sub">{d ? <bdi>{d.reason}</bdi> : T("noReason")}</span>{m > 0 && <i className="ap-rt bad">{dl(m)}</i>}</button></li>
          ); })}
        </ul>
      )}
    </section>
  );

  const events = ok ? [...ok.events].sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)).slice(0, 8) : [];
  const logBox = ok && showLog && phase !== "approach" && (
    <section className="ap-sec" aria-label={T("log")}>
      <h3 className="ap-h">{T("log")}</h3>
      {events.length === 0 ? <p className="ap-none">{T("noLog")}</p> : (
        <ul className="ap-list plain">
          {events.map((e, i) => (
            <li key={`${e.milestone}-${e.occurred_at}-${i}`}><div><span className="ap-t ltr">{hm(e.occurred_at)}</span><b dir="auto">{names[e.milestone] ?? e.milestone}</b>{e.corrected && <em className="ap-fix">{T("fixed")}</em>}</div></li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className={`ap tone-${tone}${calm ? " calm" : ""} ph-${phase}`} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="ap-hero">
        {map}
        <div className="ap-over">
          <div className="ap-head" aria-live="polite">{head}</div>
          <div className="ap-id"><span className="ltr">{idLabel}</span>{badge}</div>
        </div>
      </div>
      <p className="ap-note">{T("mapNote")}</p>
      {prePanel}
      {gantt}
      {cards}
      {delaysBox}
      {logBox}
    </div>
  );
}
