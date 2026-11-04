"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import Hint from "@/components/Hint";
import { useT } from "@/components/I18n";
import { LAYOUT, FALLBACK } from "@/lib/otp-layout";
import type { OtpState, OtpStep, OtpAttribution } from "@/lib/otp";
import { otpLoadReasons, otpOpenTurn, otpRecordEnd, otpRecordStart, otpSetInBlock, otpStateReason, type ReasonOption } from "@/app/flights/otp-actions";

type Airline = { code: string; name: string | null; logoUrl: string | null } | null;
type Props = { otp: OtpState; rotationId: string; canAct: boolean; airline: Airline; flightLabel: string; registration: string | null };

const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const nowUtc = () => new Date().toISOString().slice(0, 16);
const own = (s: OtpStep) => (s.own_delay_min ?? 0) + (s.start_delay_min ?? 0);

export default function OtpStand({ otp, rotationId, canAct, airline, flightLabel, registration }: Props) {
  const { t, lang } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string | null>(null);
  const [rip, setRip] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [endAt, setEndAt] = useState(nowUtc());
  const [startAt, setStartAt] = useState(nowUtc());
  const [note, setNote] = useState("");
  const [inAt, setInAt] = useState(nowUtc());
  const [reasons, setReasons] = useState<ReasonOption[] | null>(null);

  const ok = otp.status === "ok" ? otp : null;
  const steps = useMemo(() => ok?.snapshot.steps ?? [], [ok]);
  const body = ok?.snapshot.turn.body_class ?? (otp.status === "no_turn" ? otp.body_class : null);

  // Photo slot: a real top-down photo in public/otp replaces the drawn aircraft when present.
  useEffect(() => {
    const tries = [body ? `/otp/stand-${body}.jpg` : null, "/otp/stand.jpg"].filter(Boolean) as string[];
    let alive = true;
    const go = (i: number) => {
      if (i >= tries.length) return;
      const im = new Image();
      im.onload = () => { if (alive) setPhoto(tries[i]); };
      im.onerror = () => go(i + 1);
      im.src = tries[i];
    };
    go(0);
    return () => { alive = false; };
  }, [body]);

  // Keep the numbers live while the aircraft is on the stand.
  useEffect(() => {
    if (!ok || ok.snapshot.ground.state === "completed") return;
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60000);
    return () => clearInterval(id);
  }, [ok, router]);

  // First thing worth looking at: a service waiting for confirmation, then one running, then the latest late one.
  const auto = useMemo(() => {
    const by = (st: string) => steps.find((s) => s.step_state === st)?.step_code;
    return by("overdue_unconfirmed") ?? by("in_window") ?? [...steps].reverse().find((s) => s.step_state === "done_late")?.step_code ?? null;
  }, [steps]);
  const cur = sel ?? auto;
  const st = steps.find((s) => s.step_code === cur) ?? null;

  const children = useMemo(() => {
    const m = new Map<string, string[]>();
    steps.forEach((s) => { if (s.pred_code) m.set(s.pred_code, [...(m.get(s.pred_code) ?? []), s.step_code]); });
    return m;
  }, [steps]);
  const depth = useMemo(() => {
    const d = new Map<string, number>(); if (!cur) return d;
    let q: [string, number][] = [[cur, 0]];
    while (q.length) { const [c, k] = q.shift()!; (children.get(c) ?? []).forEach((x) => { if (!d.has(x)) { d.set(x, k + 1); q.push([x, k + 1]); } }); }
    return d;
  }, [cur, children]);

  const lateEnough = !!st && st.step_state !== "upcoming" && (st.late_vs_plan_min ?? 0) >= 3;
  useEffect(() => {
    setReasons(null); setMsg(null); setNote("");
    if (!ok || !st || !canAct || !lateEnough) return;
    let alive = true;
    otpLoadReasons(ok.turn_id, st.step_code, lang).then((r) => { if (alive && r.ok) setReasons(r.reasons); });
    return () => { alive = false; };
  }, [ok?.turn_id, st?.step_code, lateEnough, canAct, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (fn: () => Promise<{ ok: true } | { ok: false; message: string }>) =>
    start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: t("otp.a.saved") } : { ok: false, text: r.message }); if (r.ok) { setNote(""); router.refresh(); } });

  const pick = (code: string) => { setSel(code); setRip((n) => n + 1); };

  /* ---------- no stand yet ---------- */
  if (otp.status === "no_turn") {
    return (
      <section className="card otp" aria-label={t("otp.aria")}>
        <div className="otp-head">
          {airline && <Logo url={airline.logoUrl} code={airline.code} name={airline.name} />}
          <div className="idmain"><h2>{t("otp.title")}</h2><small className="muted ltr">{flightLabel}{registration ? ` · ${registration}` : ""}</small></div>
        </div>
        <div style={{ padding: "0 22px 22px" }}>
          <h3 style={{ margin: "0 0 6px" }}>{t("otp.open.title")}</h3>
          {otp.can_open ? <>
            <p className="muted">{t("otp.open.hint")}</p>
            {canAct ? (
              <div className="otp-form">
                <label>{t("otp.in.set")}<input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn gold" disabled={pending} onClick={() => run(() => otpOpenTurn(rotationId, inAt))}>{t("otp.open.btn")}</button>
                  <button className="btn" disabled={pending} onClick={() => run(() => otpOpenTurn(rotationId, ""))}>{t("otp.open.noChocks")}</button>
                </div>
              </div>
            ) : <p className="muted">{t("otp.a.readOnly")}</p>}
          </> : <p className="muted">{t("otp.open.cant")}</p>}
          {msg && <p role="status" className={`otp-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
        </div>
      </section>
    );
  }

  /* ---------- stand open ---------- */
  const o = otp; const g = o.snapshot.ground; const turn = o.snapshot.turn;
  const left = g.minutes_left;
  const level = o.warning?.level ?? "no_data";
  const tone = level === "on_track" ? "ok" : level === "will_exceed" ? "warn" : level === "exceeded" ? "late" : level === "completed" ? (g.on_time ? "ok" : "late") : "muted";
  const unitKey = left === null ? null : left >= 0 ? (g.state === "completed" ? "otp.unit.spare" : "otp.unit.left") : "otp.unit.over";
  const stateKey = g.state === "awaiting_chocks_on" ? "otp.state.awaiting_chocks_on" : g.state === "completed" ? "otp.state.completed" : "otp.state.running";
  const names = o.names;
  const nm = (s: OtpStep) => names[s.step_code] ?? s.step_name_ar ?? s.step_code;
  const delayOf = st ? [...o.delays].reverse().find((d) => d.milestone === st.step_code) : undefined;

  const chip = (s: OtpStep) => {
    switch (s.step_state) {
      case "done": return t("otp.s.done", { time: hm(s.actual_end) });
      case "done_late": return t("otp.s.doneLate", { time: hm(s.actual_end), n: own(s) });
      case "in_window": return t("otp.s.inWindow", { time: hm(s.planned_end) });
      case "overdue_unconfirmed": return t("otp.s.overdue");
      default: return t("otp.s.upcoming", { time: hm(s.planned_end) });
    }
  };
  const tagOf = (s: OtpStep) => ({ done: ["ok", "otp.tag.done"], done_late: ["warn", "otp.tag.late"], in_window: ["info", "otp.tag.running"], overdue_unconfirmed: ["late", "otp.tag.overdue"], upcoming: ["info", "otp.tag.upcoming"] } as const)[s.step_state];

  const attr: OtpAttribution[] = o.snapshot.attribution ?? [];
  const maxAbs = Math.max(1, ...attr.map((a) => Math.abs(a.minutes)));
  const attrLabel = (a: OtpAttribution) => (a.step_code ? names[a.step_code] ?? a.step_code : t((`otp.attr.${["arrival_shift", "float_absorbed", "schedule_buffer"].includes(a.category) ? a.category : "other"}`) as "otp.attr.other"));
  const total = (o.snapshot as { projected_departure_delay_min?: number | null }).projected_departure_delay_min;
  const done = !!st && (st.step_state === "done" || st.step_state === "done_late");

  return (
    <section className="card otp" aria-label={t("otp.aria")}>
      <div className="otp-head">
        {airline && <Logo url={airline.logoUrl} code={airline.code} name={airline.name} />}
        <div className="idmain"><h2>{t("otp.title")}</h2><small className="muted ltr">{flightLabel}{(turn.registration ?? registration) ? ` · ${turn.registration ?? registration}` : ""}</small></div>
        <span className="tag info">{t(`otp.body.${turn.body_class === "wide" ? "wide" : "narrow"}` as "otp.body.wide")}</span>
        {o.is_demo && <span className="tag warn">{t("otp.demo")}</span>}
        <Hint>{t("otp.stage.aria")}</Hint>
      </div>

      <div className="otp-grid">
        {/* ---- the aircraft ---- */}
        <div className={`otp-stage${photo ? " photo" : ""}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined} role="group" aria-label={t("otp.stage.aria")}>
          <svg viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true">
            {!photo && <g className="otp-grid-bg" stroke="rgba(163,179,203,.12)">{Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={i * 28} x2={i * 28} y1="0" y2="520" />)}{Array.from({ length: 19 }, (_, i) => <line key={`h${i}`} y1={i * 28} y2={i * 28} x1="0" x2="400" />)}</g>}
            {!photo && <g fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.38)" strokeWidth="1.6">
              <path d="M172 205 L40 300 L40 324 L172 272Z" /><path d="M228 205 L360 300 L360 324 L228 272Z" />
              <path d="M172 432 L108 468 L108 484 L172 462Z" /><path d="M228 432 L292 468 L292 484 L228 462Z" />
              <rect x="90" y="292" width="26" height="46" rx="12" /><rect x="284" y="292" width="26" height="46" rx="12" />
              <path d="M200 28C222 28 230 60 230 100L230 420C230 455 216 480 200 496C184 480 170 455 170 420L170 100C170 60 178 28 200 28Z" />
            </g>}
            {steps.filter((s) => s.pred_code).map((s) => {
              const a = LAYOUT[s.pred_code!] ?? FALLBACK, b = LAYOUT[s.step_code] ?? FALLBACK;
              const pd = steps.find((x) => x.step_code === s.pred_code);
              const hot = (cur === s.pred_code || cur === s.step_code) || (depth.has(s.step_code) && (cur === s.pred_code || depth.has(s.pred_code!)));
              const late = pd?.step_state === "done_late";
              return <line key={`e-${s.step_code}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? "var(--gold)" : late ? "var(--warn)" : "rgba(163,179,203,.45)"} strokeWidth={hot ? 2 : 1.3} strokeDasharray={hot ? undefined : "3 4"} />;
            })}
            {steps.map((s) => { const p = LAYOUT[s.step_code] ?? FALLBACK; if (p.side === "C") return null;
              return <line key={`l-${s.step_code}`} x1={p.side === "L" ? p.x - 21 : p.x + 21} x2={p.side === "L" ? 124 : 276} y1={p.y} y2={p.y} stroke="rgba(163,179,203,.35)" strokeWidth="1.2" strokeDasharray="2 3" />; })}
          </svg>

          {steps.map((s) => {
            const p = LAYOUT[s.step_code] ?? FALLBACK; const d = depth.get(s.step_code);
            const pos = { left: `${(p.x / 400) * 100}%`, top: `${(p.y / 520) * 100}%` };
            return (
              <div key={s.step_code}>
                <button type="button" className={`otp-n ${s.step_state}${cur === s.step_code ? " sel" : ""}`} style={pos} onClick={() => pick(s.step_code)}
                  aria-pressed={cur === s.step_code} aria-label={`${nm(s)}: ${chip(s)}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.icon} /></svg>
                  {s.step_state === "done_late" && <span className="bd">+{own(s)}</span>}
                  {s.step_state === "done" && <span className="bd ok">✓</span>}
                  {d !== undefined && <i key={`${cur}-${rip}`} className="ring rip" style={{ ["--d" as string]: `${d * 0.35}s` }} />}
                </button>
                <div className={`otp-c ${p.side}${cur === s.step_code ? " sel" : ""}`} style={{ top: pos.top }}>
                  <b><bdi>{nm(s)}</bdi></b><small>{chip(s)}</small>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- the numbers and the selected service ---- */}
        <div>
          <small className="muted">{t(stateKey)}</small>
          <div className="otp-hero">
            <span className={`otp-num ${tone} ltr`}>{g.state === "awaiting_chocks_on" || left === null ? "—" : left >= 0 ? left : `+${-left}`}</span>
            {unitKey && <span className="otp-unit">{t(unitKey)}</span>}
          </div>
          {o.warning?.message && <p className="otp-say">{o.warning.message}</p>}
          {!g.defs_approved && <p className="muted" style={{ fontSize: 12.5 }}>{t("otp.draftNote")}</p>}

          <dl className="otp-kv">
            {g.allowed_ground_min !== null && <div><dt>{t("otp.allowed")}</dt><dd>{t("otp.d.min", { n: g.allowed_ground_min })}</dd></div>}
            {g.elapsed_ground_min !== null && <div><dt>{t("otp.elapsed")}</dt><dd>{t("otp.d.min", { n: g.elapsed_ground_min })}</dd></div>}
            <div><dt>{t("otp.std")}</dt><dd className="ltr">{hm(g.original_std ?? turn.std)}</dd></div>
            {g.target_departure && <div><dt>{t("otp.target")}</dt><dd className="ltr">{hm(g.target_departure)}</dd></div>}
            {g.projected_off_block && <div><dt>{t("otp.projected")}</dt><dd className="ltr">{hm(g.projected_off_block)}</dd></div>}
          </dl>

          {!turn.in_block_at && (
            <div className="otp-sec">
              <p className="muted">{t("otp.in.need")}</p>
              {canAct && <div className="otp-form"><label>{t("otp.in.set")}<input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
                <button className="btn gold" disabled={pending} onClick={() => run(() => otpSetInBlock(o.turn_id, inAt))}>{t("otp.a.save")}</button></div>}
            </div>
          )}

          {attr.length > 0 && (
            <div className="otp-sec">
              <h3>{t("otp.attr.title")}{typeof total === "number" && <> · <span className="ltr">{t("otp.attr.total")} {total > 0 ? "+" : ""}{total}</span></>}</h3>
              <ul className="otp-attr">
                {attr.map((a, i) => {
                  const kind = a.minutes < 0 ? "neg" : a.kind === "external" ? "ext" : "own";
                  return (
                    <li key={i}><button type="button" className={cur && a.step_code === cur ? "sel" : ""} disabled={!a.step_code} onClick={() => a.step_code && pick(a.step_code)}>
                      <span><bdi>{attrLabel(a)}</bdi></span><span className="val ltr">{a.minutes > 0 ? "+" : ""}{a.minutes}</span>
                      <span className={`bar ${kind}`} aria-hidden="true"><i style={{ width: `${(Math.abs(a.minutes) / maxAbs) * 100}%` }} /></span>
                    </button></li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="otp-panel" aria-live="polite">
            {!st ? <p className="muted">{t("otp.pick")}</p> : <>
              <h3><bdi>{nm(st)}</bdi><span className={`tag ${tagOf(st)[0]}`}>{t(tagOf(st)[1])}</span></h3>
              <dl className="otp-kv">
                <div><dt>{t("otp.d.planned")}</dt><dd className="ltr">{hm(st.planned_end)}</dd></div>
                {!done && <div><dt>{t("otp.d.expected")}</dt><dd className="ltr">{hm(st.expected_end)}</dd></div>}
                {done && <div><dt>{t("otp.d.actual")}</dt><dd className="ltr">{hm(st.actual_end)}</dd></div>}
                {st.actual_start && <div><dt>{t("otp.d.started")}</dt><dd className="ltr">{hm(st.actual_start)}</dd></div>}
                {st.late_vs_plan_min !== null && st.late_vs_plan_min !== 0 && <div><dt>{t("otp.d.lateVsPlan")}</dt><dd>{st.late_vs_plan_min > 0 ? "+" : ""}{t("otp.d.min", { n: st.late_vs_plan_min })}</dd></div>}
                {(st.start_delay_min ?? 0) > 0 && <div><dt>{t("otp.d.startLate")}</dt><dd>{t("otp.d.min", { n: st.start_delay_min ?? 0 })}</dd></div>}
                {(st.own_delay_min ?? 0) > 0 && <div><dt>{t("otp.d.workLong")}</dt><dd>{t("otp.d.min", { n: st.own_delay_min ?? 0 })}</dd></div>}
                {(() => { const inh = (st.late_vs_plan_min ?? 0) - own(st); return inh > 0 ? <div><dt>{t("otp.d.inherited")}</dt><dd>{t("otp.d.min", { n: inh })}</dd></div> : null; })()}
              </dl>

              {lateEnough && <p style={{ margin: "10px 0 0" }}><b>{t("otp.d.reason")}:</b> {delayOf ? <bdi>{delayOf.reason}</bdi> : <span className="muted">{t("otp.d.noReason")}</span>}</p>}

              {!canAct ? <p className="muted" style={{ marginTop: 10 }}>{t("otp.a.readOnly")}</p> : <>
                {st.needs_start && (
                  <div className="otp-form">
                    <label>{t("otp.a.startQ")}<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
                    <button className="btn gold" disabled={pending} onClick={() => run(() => otpRecordStart(o.turn_id, st.step_code, startAt, ""))}>{t("otp.a.saveStart")}</button>
                  </div>
                )}
                {lateEnough && (
                  <div style={{ marginTop: 10 }}>
                    <small className="muted">{t("otp.a.pickReason")}</small>
                    {reasons === null ? <p className="muted">{t("otp.a.loading")}</p> : reasons.length === 0 ? <p className="muted">{t("otp.a.noReasons")}</p> :
                      <div className="otp-reasons">{reasons.map((r) => <button key={r.key} type="button" disabled={pending} className={delayOf?.reason_key === r.key ? "on" : ""} onClick={() => run(() => otpStateReason(o.turn_id, st.step_code, r.key))}><bdi>{r.label}</bdi></button>)}</div>}
                  </div>
                )}
                <div className="otp-form">
                  <label>{done ? t("otp.a.correct") : t("otp.a.recordEnd")}<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
                  {done && <label>{t("otp.a.correctWhy")}<input type="text" value={note} onChange={(e) => setNote(e.target.value)} style={{ direction: "inherit" }} /></label>}
                  <button className={done ? "btn" : "btn gold"} disabled={pending || (done && note.trim().length < 3)} onClick={() => run(() => otpRecordEnd(o.turn_id, st.step_code, endAt, note))}>{t("otp.a.save")}</button>
                </div>
              </>}
              {msg && <p role="status" className={`otp-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}
