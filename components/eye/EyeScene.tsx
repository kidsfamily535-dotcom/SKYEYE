"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18n";
import { eyeText } from "@/lib/eye/i18n";
import { LAYOUT, FALLBACK, SCENE_W, SCENE_H, landscape } from "@/lib/otp-layout";
import type { OtpState, OtpStep } from "@/lib/otp";

// The airline's stand scene: a pure, view-only component. It imports no server actions and no recording controls,
// so nothing from the SKYEYE staff side can be reached from here. It reuses the otps-* look of the SKYEYE scene (globals.css).
// Wording is calm: amber (never red) marks a delay, and nobody is blamed (the "responsibility" field is never shown).

type Ok = Extract<OtpState, { status: "ok" }>;
const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const own = (s: OtpStep) => (s.own_delay_min ?? 0) + (s.start_delay_min ?? 0);
const isLate = (s: OtpStep) => s.step_state === "overdue_unconfirmed" || (s.step_state === "in_window" && (s.late_vs_plan_min ?? 0) >= 3);
const fill = (s: string, n: number) => s.replace("{n}", String(n));

export default function EyeScene({ otp, flightLabel, registration }: { otp: Ok; flightLabel: string; registration: string | null }) {
  const { lang } = useT();
  const t = eyeText(lang);
  const router = useRouter();
  const [sel, setSel] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const { snapshot: snap, names, delays } = otp;
  const { turn, ground: g, steps } = snap;
  const finished = g.state === "completed";
  const waiting = g.state === "awaiting_chocks_on";
  const left = g.minutes_left;
  const level = otp.warning?.level ?? "no_data";
  const tone = level === "on_track" ? "ok" : level === "will_exceed" || level === "exceeded" ? "warn" : level === "completed" ? (g.on_time ? "ok" : "warn") : "muted";
  const nm = (s: OtpStep) => names[s.step_code] ?? s.step_name_ar ?? s.step_code;
  const st = sel ? steps.find((s) => s.step_code === sel) ?? null : null;

  // Photo slot: a licensed top-down photo in public/otp (landscape 520:400, nose right) replaces the drawn aircraft when present.
  useEffect(() => {
    const body = turn.body_class;
    const tries = [body ? `/otp/stand-${body}.jpg` : null, "/otp/stand.jpg"].filter(Boolean) as string[];
    let alive = true;
    const go = (i: number) => { if (i >= tries.length) return; const im = new Image(); im.onload = () => { if (alive) setPhoto(tries[i]); }; im.onerror = () => go(i + 1); im.src = tries[i]; };
    go(0);
    return () => { alive = false; };
  }, [turn.body_class]);

  // Live while the aircraft is on the stand; skips refreshing while offline so the last good view stays on screen.
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => { setNowMs(Date.now()); if (document.visibilityState === "visible" && navigator.onLine) router.refresh(); }, 60000);
    setNowMs(Date.now());
    return () => clearInterval(id);
  }, [finished, router]);

  useEffect(() => {
    if (!st) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [st]);

  const art = useMemo(() => (photo
    ? <div className="otps-art" style={{ backgroundImage: `url(${photo})` }} />
    : <svg className="otps-art otps-draw" viewBox="0 0 520 400" aria-hidden="true">
        <g transform="translate(520 0) rotate(90)" fill="rgba(255,255,255,.045)" stroke="rgba(244,239,227,.24)" strokeWidth="1.4">
          <path d="M172 205 L40 300 L40 324 L172 272Z" /><path d="M228 205 L360 300 L360 324 L228 272Z" />
          <path d="M172 432 L108 468 L108 484 L172 462Z" /><path d="M228 432 L292 468 L292 484 L228 462Z" />
          <rect x="90" y="292" width="26" height="46" rx="12" /><rect x="284" y="292" width="26" height="46" rx="12" />
          <path d="M200 28C222 28 230 60 230 100L230 420C230 455 216 480 200 496C184 480 170 455 170 420L170 100C170 60 178 28 200 28Z" />
        </g>
      </svg>), [photo]);

  const bg = <><div className={`otps-bg${photo ? " photo" : ""}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined} /><div className="otps-vig" /></>;
  const reg = turn.registration ?? registration;
  const top = <header className="otps-top"><div className="idmain"><small className="ltr">{flightLabel}{reg ? ` · ${reg}` : ""}</small></div></header>;

  const tagOf = (s: OtpStep) => ({ done: t("tagDone"), done_late: t("tagLate"), in_window: t("tagRunning"), overdue_unconfirmed: t("tagWaiting"), upcoming: t("tagUpcoming") }[s.step_state]);
  const chipOf = (s: OtpStep) => s.step_state === "done" ? `${t("tagDone")} · ${hm(s.actual_end)}` : s.step_state === "done_late" ? `${t("tagLate")} · ${hm(s.actual_end)} (+${own(s)})` : s.step_state === "upcoming" ? `${t("tagUpcoming")} · ${hm(s.planned_end)}` : tagOf(s);

  // Film strip positions (placement only, no new numbers).
  const inMs = turn.in_block_at ? Date.parse(turn.in_block_at) : null;
  const endIso = g.target_departure ?? turn.std;
  const endMs = endIso ? Date.parse(endIso) : null;
  const span = inMs !== null && endMs !== null && endMs > inMs ? endMs - inMs : null;
  const at = (iso: string | null | undefined) => (span !== null && inMs !== null && iso ? Math.min(100, Math.max(0, ((Date.parse(iso) - inMs) / span) * 100)) : null);
  const progress = finished ? 100 : nowMs !== null && span !== null && inMs !== null ? Math.min(100, Math.max(0, ((nowMs - inMs) / span) * 100)) : null;

  const nodes = steps.map((s) => {
    const p = LAYOUT[s.step_code] ?? FALLBACK;
    const q = landscape(p);
    const pos = { left: `${(q.x / SCENE_W) * 100}%`, top: `${(q.y / SCENE_H) * 100}%` };
    const place = `${q.y / SCENE_H >= 0.5 ? "T" : "B"}${q.x / SCENE_W > 0.72 ? "r" : q.x / SCENE_W < 0.28 ? "l" : "c"}`;
    const on = sel === s.step_code;
    return (
      <div key={s.step_code}>
        <button type="button" className={`otps-n ${s.step_state}${isLate(s) ? " late" : ""}${on ? " sel" : ""}`} style={pos} onClick={() => setSel(on ? null : s.step_code)} aria-pressed={on} aria-label={`${nm(s)}: ${chipOf(s)}`}>
          <span className="dot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.icon} /></svg>{s.step_state === "done_late" && <span className="bd">+{own(s)}</span>}</span>
        </button>
        {on && <div className={`otps-tag ${place}`} style={pos}><b><bdi>{nm(s)}</bdi></b></div>}
      </div>
    );
  });

  /* ---- departure log: what the airline reads after the aircraft has left ---- */
  const totalDelay = snap.projected_departure_delay_min;
  const offBlock = steps.find((s) => s.step_code === "off_block")?.actual_end ?? null;
  const headline = g.on_time ? t("logOnTime") : typeof totalDelay === "number" && totalDelay > 0 ? fill(t("logDelayed"), totalDelay) : t("logPlain");
  const causes = delays.filter((d) => (d.minutes ?? 0) > 0 || d.reason);
  const log = (
    <section className="eye-log" aria-label={t("logTitle")}>
      <h2>{t("logTitle")}</h2>
      <p className="eye-log-sub">{t("logSub")}</p>
      <dl className="eye-log-times ltr">
        <div><dt>{t("logOnStand")}</dt><dd>{hm(turn.in_block_at)}</dd></div>
        <div><dt>{t("logPlannedDep")}</dt><dd>{hm(g.original_std ?? turn.std)}</dd></div>
        <div><dt>{t("logOffBlock")}</dt><dd>{hm(offBlock)}</dd></div>
      </dl>
      <h3>{t("logWhat")}</h3>
      {causes.length === 0 ? <p className="eye-log-none">{t("logNoDelays")}</p> : (
        <ul className="eye-log-list">
          {causes.map((d, i) => (
            <li key={`${d.milestone}-${i}`}>
              <i aria-hidden="true" />
              <span><bdi>{names[d.milestone] ?? d.milestone}</bdi>{d.reason ? <> — <bdi>{d.reason}</bdi></> : null}</span>
              {d.minutes ? <b dir="auto">{fill(t("logMin"), d.minutes)}</b> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  if (waiting) {
    return (
      <section className="otps pre eye-scene" aria-label={t("sceneAria")}>
        {bg}{top}
        <div className="otps-time">
          <small>{t("toArrive")}</small>
          <span className="otps-num muted ltr">{hm(turn.sta)}</span>
          <span className="otps-unit">{t("sta")} · UTC</span>
        </div>
        <div className="otps-stage">{art}</div>
      </section>
    );
  }

  const calm = level === "on_track" ? t("calmOk") : level === "will_exceed" ? t("calmSoon") : level === "exceeded" ? t("calmOver") : null;
  return (
    <>
      <section className={`otps eye-scene tone-${tone}${finished ? " final" : ""}`} aria-label={t("sceneAria")}>
        {bg}{top}
        {finished ? (
          <div className="otps-final" role="status"><b>{headline}</b></div>
        ) : (
          <div className="otps-time" aria-live="polite">
            <small>{t("onStandNow")}</small>
            <span className={`otps-num ${tone} ltr`}>{left === null ? "—" : left >= 0 ? left : `+${-left}`}</span>
            <span className="otps-unit">{left === null ? t("noData") : left >= 0 ? t("unitLeft") : t("unitOver")}</span>
            {calm && <p className="otps-say">{calm}</p>}
          </div>
        )}

        <div className="otps-stage" role="group" aria-label={t("stageAria")}>
          {art}
          <div className="otps-taxi" aria-hidden="true">{Array.from({ length: 9 }, (_, k) => <i key={k} style={{ ["--i" as string]: k }} />)}</div>
          {nodes}
        </div>

        <div className="otps-strip" role="img" aria-label={t("stripAria")}>
          <div className="otps-line">
            {progress !== null && <i className="otps-fill" style={{ width: `${progress}%` }} />}
            {steps.map((s) => { const x = at(s.actual_end ?? s.expected_end ?? s.planned_end); return x === null ? null : <i key={s.step_code} className={`otps-tick ${s.step_state}${isLate(s) ? " late" : ""}`} style={{ left: `${x}%` }} />; })}
          </div>
          <div className="otps-ends ltr"><span>{hm(turn.in_block_at)}</span><span>{hm(endIso)}</span></div>
        </div>

        {st && (
          <div className="otps-sheet" role="dialog" aria-label={nm(st)} aria-live="polite">
            <div className="grab" aria-hidden="true" />
            <button type="button" className="x" onClick={() => setSel(null)} aria-label={t("close")}>×</button>
            <h3><bdi>{nm(st)}</bdi><span className={`otps-chip ${st.step_state}`}>{tagOf(st)}</span></h3>
            <p className="otps-lines eye-lines">
              <span>{t("dPlanned")} <b className="ltr">{hm(st.planned_end)}</b></span>
              {st.step_state === "done" || st.step_state === "done_late" ? <span>{t("dActual")} <b className="ltr">{hm(st.actual_end)}</b></span> : <span>{t("dExpected")} <b className="ltr">{hm(st.expected_end)}</b></span>}
              {st.actual_start && <span>{t("dStarted")} <b className="ltr">{hm(st.actual_start)}</b></span>}
            </p>
            {(st.step_state === "done_late" || (st.step_state !== "upcoming" && delays.some((x) => x.milestone === st.step_code))) && (() => {
              const d = [...delays].reverse().find((x) => x.milestone === st.step_code);
              return <p className="otps-lines"><b>{t("dReason")}:</b> {d ? <bdi>{d.reason}</bdi> : <span>{t("dNoReason")}</span>}</p>;
            })()}
          </div>
        )}
      </section>
      {finished && log}
    </>
  );
}
