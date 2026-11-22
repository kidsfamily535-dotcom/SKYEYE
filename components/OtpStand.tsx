"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18n";
import ApronStand, { type ApronTone } from "@/components/ApronStand";
import type { OtpState, OtpStep } from "@/lib/otp";
import { otpLoadReasons, otpOpenTurn, otpRecordEnd, otpRecordStart, otpSetInBlock, otpStateReason, type ReasonOption } from "@/app/flights/otp-actions";

// SKYEYE side of the apron scene: the flight page IS the OTP unit. The scene itself is components/ApronStand.tsx (shared with Airline Eye);
// this wrapper only adds what staff can do: open the turn, set chocks-on, record a service end/start, state a delay reason.
// Everything shown comes from otp_turn_state (via lib/otp.ts); nothing is guessed here.

type Props = { otp: OtpState; rotationId: string; canAct: boolean; flightLabel: string; registration: string | null; stage?: boolean; panelTop?: React.ReactNode; panelBottom?: React.ReactNode };
type Res = { ok: true } | { ok: false; message: string };

const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const nowUtc = () => new Date().toISOString().slice(0, 16);

export default function OtpStand({ otp, rotationId, canAct, flightLabel, registration, stage, panelTop, panelBottom }: Props) {
  const { t, lang } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [endAt, setEndAt] = useState(nowUtc());
  const [startAt, setStartAt] = useState(nowUtc());
  const [inAt, setInAt] = useState(nowUtc());
  const [note, setNote] = useState("");
  const [askStart, setAskStart] = useState(false);
  const [askFix, setAskFix] = useState(false);
  const [reasons, setReasons] = useState<ReasonOption[] | null>(null);

  const ok = otp.status === "ok" ? otp : null;
  const st = ok && sel ? ok.snapshot.steps.find((s) => s.step_code === sel) ?? null : null;
  const lateEnough = !!st && st.step_state !== "upcoming" && (st.late_vs_plan_min ?? 0) >= 3;

  useEffect(() => {
    setReasons(null); setMsg(null); setNote(""); setAskStart(false); setAskFix(false);
    if (!ok || !st || !canAct || !lateEnough) return;
    let alive = true;
    otpLoadReasons(ok.turn_id, st.step_code, lang).then((r) => { if (alive && r.ok) setReasons(r.reasons); });
    return () => { alive = false; };
  }, [ok?.turn_id, st?.step_code, lateEnough, canAct, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (fn: () => Promise<Res>, closeOnOk = false) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: t("otp.a.saved") } : { ok: false, text: r.message });
      if (r.ok) { setNote(""); setAskStart(false); setAskFix(false); if (closeOnOk) setSel(null); router.refresh(); }
    });

  const label = [flightLabel, ok?.snapshot.turn.registration ?? registration].filter(Boolean).join(" · ");
  const demo = ok?.is_demo ? <span className="ap-demo">{t("otp.demo")}</span> : null;
  const tagOf = (s: OtpStep) => t(({ done: "otp.tag.done", done_late: "otp.tag.late", in_window: "otp.tag.running", overdue_unconfirmed: "otp.tag.overdue", upcoming: "otp.tag.upcoming" } as const)[s.step_state]);

  /* ---------- before chocks-on: the aircraft is only inbound ---------- */
  if (!ok || ok.snapshot.ground.state === "awaiting_chocks_on") {
    const sta = ok ? ok.snapshot.turn.sta : otp.status === "no_turn" ? otp.sta : null;
    const head = <><small>{t(ok ? "otp.state.awaiting_chocks_on" : "ots.pre.title")}</small><span className="ap-num muted ltr">{hm(sta)}</span><span className="ap-unit">{t("ots.pre.sta")} · UTC</span></>;
    const pre = !ok ? (
      <section className="ap-pre">
        <h3>{t("otp.open.title")}</h3>
        {otp.status === "no_turn" && otp.can_open ? <>
          <p>{t("otp.open.hint")}</p>
          {canAct ? (
            <div className="ap-form">
              <label>{t("otp.in.set")}<input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
              <div className="ap-act">
                <button className="ap-big" disabled={pending} onClick={() => run(() => otpOpenTurn(rotationId, inAt))}>{t("otp.open.btn")}</button>
                <button className="ap-ghost" disabled={pending} onClick={() => run(() => otpOpenTurn(rotationId, ""))}>{t("otp.open.noChocks")}</button>
              </div>
            </div>
          ) : <p>{t("otp.a.readOnly")}</p>}
        </> : <p>{t("otp.open.cant")}</p>}
        {msg && <p role="status" className={`ap-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      </section>
    ) : (
      <section className="ap-pre">
        <p>{t("otp.in.need")}</p>
        {canAct && <div className="ap-form"><label>{t("otp.in.set")}<input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
          <div className="ap-act"><button className="ap-big" disabled={pending} onClick={() => run(() => otpSetInBlock(ok.turn_id, inAt))}>{t("otp.a.save")}</button></div></div>}
        {msg && <p role="status" className={`ap-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      </section>
    );
    return <ApronStand otp={otp} lang={lang} tone="muted" head={head} idLabel={label} badge={demo} sel={null} onSel={() => {}} tag={tagOf} prePanel={pre} stage={stage} panelTop={panelTop} panelBottom={panelBottom} />;
  }

  /* ---------- on the stand / left ---------- */
  const g = ok.snapshot.ground;
  const left = g.minutes_left;
  const finished = g.state === "completed";
  const level = ok.warning?.level ?? "no_data";
  const tone: ApronTone = level === "on_track" ? "ok" : level === "will_exceed" ? "warn" : level === "exceeded" ? "late" : level === "completed" ? (g.on_time ? "ok" : "late") : "muted";
  const unitKey = left === null ? null : left >= 0 ? (finished ? "otp.unit.spare" : "otp.unit.left") : "otp.unit.over";
  const totalDelay = ok.snapshot.projected_departure_delay_min;
  const finalText = g.on_time ? t("ots.final.ok") : typeof totalDelay === "number" && totalDelay > 0 ? t("ots.final.late", { n: totalDelay }) : t("ots.final.plain");
  const head = finished
    ? <div className="ap-final" role="status"><b>{finalText}</b><small>{t("ots.final.sub")}</small></div>
    : <><small>{t("otp.state.running")}</small><span className={`ap-num ${tone} ltr`}>{left === null ? "—" : left >= 0 ? left : `+${-left}`}</span>{unitKey && <span className="ap-unit">{t(unitKey)}</span>}
        {ok.warning?.message && <p className="ap-say">{ok.warning.message}</p>}
        {!g.defs_approved && <p className="ap-draft">{t("otp.draftNote")}</p>}</>;

  const panel = (s: OtpStep, ctx: { late: boolean; delay?: { reason_key: string } }) => {
    const done = s.step_state === "done" || s.step_state === "done_late";
    if (!canAct) return <p className="ap-lines">{t("otp.a.readOnly")}</p>;
    return (
      <>
        {ctx.late && (reasons === null ? <p className="ap-lines">{t("otp.a.loading")}</p> : reasons.length === 0 ? null :
          <div className="otp-reasons">{reasons.map((r) => <button key={r.key} type="button" disabled={pending} className={ctx.delay?.reason_key === r.key ? "on" : ""} onClick={() => run(() => otpStateReason(ok.turn_id, s.step_code, r.key))}><bdi>{r.label}</bdi></button>)}</div>)}
        {!done && (
          <div className="ap-act">
            <button className="ap-big" disabled={pending} onClick={() => run(() => otpRecordEnd(ok.turn_id, s.step_code, nowUtc(), ""), true)}>{t("ots.doneNow")}</button>
            {s.needs_start && <button className="ap-ghost" disabled={pending} onClick={() => setAskStart((v) => !v)}>{t("ots.startWhen")}</button>}
          </div>
        )}
        {!done && askStart && (
          <div className="ap-form">
            <label>{t("otp.a.startQ")}<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
            <div className="ap-act">
              <button className="ap-big" disabled={pending} onClick={() => run(() => otpRecordStart(ok.turn_id, s.step_code, startAt, ""))}>{t("otp.a.saveStart")}</button>
              <button className="ap-ghost" disabled={pending} onClick={() => run(() => otpRecordStart(ok.turn_id, s.step_code, nowUtc(), ""))}>{t("ots.startNow")}</button>
            </div>
          </div>
        )}
        {done && <div className="ap-act"><button className="ap-ghost" onClick={() => setAskFix((v) => !v)}>{t("ots.fix")}</button></div>}
        {done && askFix && (
          <div className="ap-form">
            <label>{t("otp.a.correct")}<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
            <label>{t("otp.a.correctWhy")}<input type="text" value={note} onChange={(e) => setNote(e.target.value)} style={{ direction: "inherit" }} /></label>
            <div className="ap-act"><button className="ap-big" disabled={pending || note.trim().length < 3} onClick={() => run(() => otpRecordEnd(ok.turn_id, s.step_code, endAt, note))}>{t("otp.a.save")}</button></div>
          </div>
        )}
        {msg && <p role="status" className={`ap-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      </>
    );
  };

  return <ApronStand otp={otp} lang={lang} tone={tone} head={head} idLabel={label} badge={demo} sel={sel} onSel={setSel} tag={tagOf} stepPanel={panel} stage={stage} panelTop={panelTop} panelBottom={panelBottom} />;
}

