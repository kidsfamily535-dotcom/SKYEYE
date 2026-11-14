"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { useT } from "@/components/I18n";
import { LAYOUT, FALLBACK } from "@/lib/otp-layout";
import type { OtpState, OtpStep } from "@/lib/otp";
import { otpLoadReasons, otpOpenTurn, otpRecordEnd, otpRecordStart, otpSetInBlock, otpStateReason, type ReasonOption } from "@/app/flights/otp-actions";

// "Stand scene": the turnaround as one dark, cinematic picture instead of a card with numbers.
// Everything shown comes from otp_turn_state (via lib/otp.ts); nothing is guessed here, only shaped for display.

type Airline = { code: string; name: string | null; logoUrl: string | null } | null;
type Props = { otp: OtpState; rotationId: string; canAct: boolean; airline: Airline; flightLabel: string; registration: string | null };
type Res = { ok: true } | { ok: false; message: string };

const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const nowUtc = () => new Date().toISOString().slice(0, 16);
const own = (s: OtpStep) => (s.own_delay_min ?? 0) + (s.start_delay_min ?? 0);
const isLate = (s: OtpStep) => s.step_state === "overdue_unconfirmed" || (s.step_state === "in_window" && (s.late_vs_plan_min ?? 0) >= 3);

export default function OtpStand({ otp, rotationId, canAct, airline, flightLabel, registration }: Props) {
  const { t, lang } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [endAt, setEndAt] = useState(nowUtc());
  const [startAt, setStartAt] = useState(nowUtc());
  const [inAt, setInAt] = useState(nowUtc());
  const [note, setNote] = useState("");
  const [askStart, setAskStart] = useState(false);
  const [askFix, setAskFix] = useState(false);
  const [reasons, setReasons] = useState<ReasonOption[] | null>(null);

  const ok = otp.status === "ok" ? otp : null;
  const steps = useMemo(() => ok?.snapshot.steps ?? [], [ok]);
  const body = ok?.snapshot.turn.body_class ?? (otp.status === "no_turn" ? otp.body_class : null);
  const st = open ? steps.find((s) => s.step_code === sel) ?? null : null;

  // Photo slot: a real top-down photo in public/otp replaces the drawn aircraft when present (portrait 400:520, nose up).
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

  // Keep the scene live while the aircraft is on the stand.
  useEffect(() => {
    if (ok?.snapshot.ground.state === "completed") return;
    const id = setInterval(() => { setNowMs(Date.now()); if (document.visibilityState === "visible") router.refresh(); }, 60000);
    setNowMs(Date.now());
    return () => clearInterval(id);
  }, [ok, router]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

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
      if (r.ok) { setNote(""); setAskStart(false); setAskFix(false); if (closeOnOk) setOpen(false); router.refresh(); }
    });

  const pick = (code: string) => { setSel(code); setOpen(true); };

  const top = (extra?: React.ReactNode) => (
    <header className="otps-top">
      {airline && <div className="otps-logo"><Logo url={airline.logoUrl} code={airline.code} name={airline.name} /></div>}
      <div className="idmain"><small className="ltr">{flightLabel}{(ok?.snapshot.turn.registration ?? registration) ? ` · ${ok?.snapshot.turn.registration ?? registration}` : ""}</small></div>
      {extra}
    </header>
  );

  const art = (photo
    ? <div className="otps-art" style={{ backgroundImage: `url(${photo})` }} />
    : <svg className="otps-art otps-draw" viewBox="0 0 400 520" aria-hidden="true">
        <g fill="rgba(255,255,255,.045)" stroke="rgba(244,239,227,.24)" strokeWidth="1.4">
          <path d="M172 205 L40 300 L40 324 L172 272Z" /><path d="M228 205 L360 300 L360 324 L228 272Z" />
          <path d="M172 432 L108 468 L108 484 L172 462Z" /><path d="M228 432 L292 468 L292 484 L228 462Z" />
          <rect x="90" y="292" width="26" height="46" rx="12" /><rect x="284" y="292" width="26" height="46" rx="12" />
          <path d="M200 28C222 28 230 60 230 100L230 420C230 455 216 480 200 496C184 480 170 455 170 420L170 100C170 60 178 28 200 28Z" />
        </g>
      </svg>);

  const bg = <><div className={`otps-bg${photo ? " photo" : ""}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined} /><div className="otps-vig" /></>;

  /* ---------- no stand yet: the aircraft is only a shadow ---------- */
  if (otp.status === "no_turn") {
    return (
      <section className="otps pre" aria-label={t("otp.aria")}>
        {bg}
        {top()}
        <div className="otps-time">
          <small>{t("ots.pre.title")}</small>
          <span className="otps-num muted ltr">{hm(otp.sta)}</span>
          <span className="otps-unit">{t("ots.pre.sta")} · UTC</span>
        </div>
        <div className="otps-stage">{art}</div>
        <div className="otps-intro">
          <h3>{t("otp.open.title")}</h3>
          {otp.can_open ? <>
            <p>{t("otp.open.hint")}</p>
            {canAct ? (
              <div className="otp-form">
                <label>{t("otp.in.set")}<input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
                <div className="otps-act">
                  <button className="otps-big" disabled={pending} onClick={() => run(() => otpOpenTurn(rotationId, inAt))}>{t("otp.open.btn")}</button>
                  <button className="otps-ghost" disabled={pending} onClick={() => run(() => otpOpenTurn(rotationId, ""))}>{t("otp.open.noChocks")}</button>
                </div>
              </div>
            ) : <p>{t("otp.a.readOnly")}</p>}
          </> : <p>{t("otp.open.cant")}</p>}
          {msg && <p role="status" className={`otp-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
        </div>
      </section>
    );
  }

  /* ---------- stand open ---------- */
  const o = otp; const g = o.snapshot.ground; const turn = o.snapshot.turn;
  const left = g.minutes_left;
  const finished = g.state === "completed";
  const waiting = g.state === "awaiting_chocks_on";
  const level = o.warning?.level ?? "no_data";
  const tone = level === "on_track" ? "ok" : level === "will_exceed" ? "warn" : level === "exceeded" ? "late" : level === "completed" ? (g.on_time ? "ok" : "late") : "muted";
  const unitKey = left === null ? null : left >= 0 ? (finished ? "otp.unit.spare" : "otp.unit.left") : "otp.unit.over";
  const names = o.names;
  const nm = (s: OtpStep) => names[s.step_code] ?? s.step_name_ar ?? s.step_code;
  const delayOf = st ? [...o.delays].reverse().find((d) => d.milestone === st.step_code) : undefined;
  const done = !!st && (st.step_state === "done" || st.step_state === "done_late");
  const totalDelay = o.snapshot.projected_departure_delay_min;
  const finalText = g.on_time ? t("ots.final.ok") : typeof totalDelay === "number" && totalDelay > 0 ? t("ots.final.late", { n: totalDelay }) : t("ots.final.plain");

  const chip = (s: OtpStep) => {
    switch (s.step_state) {
      case "done": return t("otp.s.done", { time: hm(s.actual_end) });
      case "done_late": return t("otp.s.doneLate", { time: hm(s.actual_end), n: own(s) });
      case "in_window": return t("otp.s.inWindow", { time: hm(s.planned_end) });
      case "overdue_unconfirmed": return t("otp.s.overdue");
      default: return t("otp.s.upcoming", { time: hm(s.planned_end) });
    }
  };
  const tagOf = (s: OtpStep) => ({ done: "otp.tag.done", done_late: "otp.tag.late", in_window: "otp.tag.running", overdue_unconfirmed: "otp.tag.overdue", upcoming: "otp.tag.upcoming" } as const)[s.step_state];

  // Film strip: planned/actual times placed between chocks-on and the target departure (positions only, no new numbers).
  const inMs = turn.in_block_at ? Date.parse(turn.in_block_at) : null;
  const endIso = g.target_departure ?? turn.std;
  const endMs = endIso ? Date.parse(endIso) : null;
  const span = inMs !== null && endMs !== null && endMs > inMs ? endMs - inMs : null;
  const at = (iso: string | null | undefined) => (span !== null && inMs !== null && iso ? Math.min(100, Math.max(0, ((Date.parse(iso) - inMs) / span) * 100)) : null);
  const fill = finished ? 100 : nowMs !== null && span !== null && inMs !== null ? Math.min(100, Math.max(0, ((nowMs - inMs) / span) * 100)) : null;

  const nodes = steps.map((s) => {
    const p = LAYOUT[s.step_code] ?? FALLBACK;
    const pos = { left: `${(p.x / 400) * 100}%`, top: `${(p.y / 520) * 100}%` };
    const cls = `otps-n ${s.step_state}${isLate(s) ? " late" : ""}${open && sel === s.step_code ? " sel" : ""}`;
    return (
      <div key={s.step_code}>
        <button type="button" className={cls} style={pos} onClick={() => pick(s.step_code)} aria-pressed={open && sel === s.step_code} aria-label={`${nm(s)}: ${chip(s)}`}>
          <span className="dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.icon} /></svg>{s.step_state === "done_late" && <span className="bd">+{own(s)}</span>}</span>
        </button>
        {open && sel === s.step_code && <div className={`otps-tag ${p.side}`} style={pos}><b><bdi>{nm(s)}</bdi></b></div>}
      </div>
    );
  });

  return (
    <section className={`otps tone-${tone}${finished ? " final" : ""}${waiting ? " pre" : ""}`} aria-label={t("otp.aria")}>
      {bg}
      {top(o.is_demo ? <span className="otps-demo">{t("otp.demo")}</span> : null)}

      {finished ? (
        <div className="otps-final" role="status"><b>{finalText}</b><small>{t("ots.final.sub")}</small></div>
      ) : (
        <div className="otps-time" aria-live="polite">
          <small>{t(waiting ? "otp.state.awaiting_chocks_on" : "otp.state.running")}</small>
          <span className={`otps-num ${waiting ? "muted" : tone} ltr`}>{waiting ? hm(turn.sta) : left === null ? "—" : left >= 0 ? left : `+${-left}`}</span>
          {waiting ? <span className="otps-unit">{t("ots.pre.sta")} · UTC</span> : unitKey && <span className="otps-unit">{t(unitKey)}</span>}
          {!waiting && o.warning?.message && <p className="otps-say">{o.warning.message}</p>}
          {!g.defs_approved && !waiting && <p className="otps-draft">{t("otp.draftNote")}</p>}
        </div>
      )}

      <div className="otps-stage" role="group" aria-label={t("otp.stage.aria")}>
        {art}
        <div className="otps-taxi" aria-hidden="true">{Array.from({ length: 9 }, (_, k) => <i key={k} style={{ ["--i" as string]: k }} />)}</div>
        {nodes}
      </div>

      <div className="otps-strip" role="img" aria-label={t("ots.strip.aria")}>
        <div className="otps-line">
          {fill !== null && <i className="otps-fill" style={{ width: `${fill}%` }} />}
          {steps.map((s) => { const x = at(s.actual_end ?? s.expected_end ?? s.planned_end); return x === null ? null : <i key={s.step_code} className={`otps-tick ${s.step_state}${isLate(s) ? " late" : ""}`} style={{ left: `${x}%` }} />; })}
        </div>
        <div className="otps-ends ltr"><span>{hm(turn.in_block_at)}</span><span>{hm(endIso)}</span></div>
      </div>

      {waiting && (
        <div className="otps-intro">
          <p>{t("otp.in.need")}</p>
          {canAct && <div className="otp-form"><label>{t("otp.in.set")}<input type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} /></label>
            <button className="otps-big" disabled={pending} onClick={() => run(() => otpSetInBlock(o.turn_id, inAt))}>{t("otp.a.save")}</button></div>}
          {msg && <p role="status" className={`otp-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
        </div>
      )}

      {st && (
        <div className="otps-sheet" role="dialog" aria-label={nm(st)} aria-live="polite">
          <div className="grab" aria-hidden="true" />
          <button type="button" className="x" onClick={() => setOpen(false)} aria-label={t("ots.close")}>×</button>
          <h3><bdi>{nm(st)}</bdi><span className={`otps-chip ${st.step_state}`}>{t(tagOf(st))}</span></h3>
          <p className="otps-lines">
            <span className="ltr">{t("otp.d.planned")} {hm(st.planned_end)}</span>
            {done ? <span className="ltr"> · {t("otp.d.actual")} {hm(st.actual_end)}</span> : <span className="ltr"> · {t("otp.d.expected")} {hm(st.expected_end)}</span>}
            {st.actual_start && <span className="ltr"> · {t("otp.d.started")} {hm(st.actual_start)}</span>}
          </p>
          {lateEnough && <p className="otps-lines"><b>{t("otp.d.reason")}:</b> {delayOf ? <bdi>{delayOf.reason}</bdi> : <span>{t("otp.d.noReason")}</span>}</p>}

          {!canAct ? <p className="otps-lines">{t("otp.a.readOnly")}</p> : <>
            {lateEnough && (reasons === null ? <p className="otps-lines">{t("otp.a.loading")}</p> : reasons.length === 0 ? null :
              <div className="otp-reasons">{reasons.map((r) => <button key={r.key} type="button" disabled={pending} className={delayOf?.reason_key === r.key ? "on" : ""} onClick={() => run(() => otpStateReason(o.turn_id, st.step_code, r.key))}><bdi>{r.label}</bdi></button>)}</div>)}

            {!done && (
              <div className="otps-act">
                <button className="otps-big" disabled={pending} onClick={() => run(() => otpRecordEnd(o.turn_id, st.step_code, nowUtc(), ""), true)}>{t("ots.doneNow")}</button>
                {st.needs_start && <button className="otps-ghost" disabled={pending} onClick={() => setAskStart((v) => !v)}>{t("ots.startWhen")}</button>}
              </div>
            )}
            {!done && askStart && (
              <div className="otp-form">
                <label>{t("otp.a.startQ")}<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
                <div className="otps-act">
                  <button className="otps-big" disabled={pending} onClick={() => run(() => otpRecordStart(o.turn_id, st.step_code, startAt, ""))}>{t("otp.a.saveStart")}</button>
                  <button className="otps-ghost" disabled={pending} onClick={() => run(() => otpRecordStart(o.turn_id, st.step_code, nowUtc(), ""))}>{t("ots.startNow")}</button>
                </div>
              </div>
            )}
            {done && <div className="otps-act one"><button className="otps-ghost" onClick={() => setAskFix((v) => !v)}>{t("ots.fix")}</button></div>}
            {done && askFix && (
              <div className="otp-form">
                <label>{t("otp.a.correct")}<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
                <label>{t("otp.a.correctWhy")}<input type="text" value={note} onChange={(e) => setNote(e.target.value)} style={{ direction: "inherit" }} /></label>
                <button className="otps-big" disabled={pending || note.trim().length < 3} onClick={() => run(() => otpRecordEnd(o.turn_id, st.step_code, endAt, note))}>{t("otp.a.save")}</button>
              </div>
            )}
          </>}
          {msg && <p role="status" className={`otp-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
        </div>
      )}
    </section>
  );
}
