"use client";
import { useState } from "react";
import { useT } from "@/components/I18n";
import ApronStand, { type ApronTone } from "@/components/ApronStand";
import { eyeText } from "@/lib/eye/i18n";
import type { OtpState, OtpStep } from "@/lib/otp";

// The airline's stand scene: the same apron scene staff see (components/ApronStand.tsx), view only.
// It imports no server actions and passes no recording controls, so nothing from the SKYEYE staff side can be reached from here.
// Wording is calm: amber (never red) marks a delay, and nobody is blamed (the "responsibility" field is never shown).

type Ok = Extract<OtpState, { status: "ok" }>;
const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const fill = (s: string, n: number) => s.replace("{n}", String(n));

export default function EyeScene({ otp, flightLabel, registration }: { otp: Ok; flightLabel: string; registration: string | null }) {
  const { lang } = useT();
  const t = eyeText(lang);
  const [sel, setSel] = useState<string | null>(null);

  const { snapshot: snap, names, delays } = otp;
  const { turn, ground: g, steps } = snap;
  const finished = g.state === "completed";
  const waiting = g.state === "awaiting_chocks_on";
  const left = g.minutes_left;
  const level = otp.warning?.level ?? "no_data";
  const tone: ApronTone = level === "on_track" ? "ok" : level === "will_exceed" || level === "exceeded" ? "warn" : level === "completed" ? (g.on_time ? "ok" : "warn") : "muted";
  const reg = turn.registration ?? registration;
  const label = [flightLabel, reg].filter(Boolean).join(" · ");
  const tagOf = (s: OtpStep) => ({ done: t("tagDone"), done_late: t("tagLate"), in_window: t("tagRunning"), overdue_unconfirmed: t("tagWaiting"), upcoming: t("tagUpcoming") }[s.step_state]);

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

  const calm = level === "on_track" ? t("calmOk") : level === "will_exceed" ? t("calmSoon") : level === "exceeded" ? t("calmOver") : null;
  const head = waiting
    ? <><small>{t("toArrive")}</small><span className="ap-num muted ltr">{hm(turn.sta)}</span><span className="ap-unit">{t("sta")} · UTC</span></>
    : finished
      ? <div className="ap-final" role="status"><b>{headline}</b></div>
      : <><small>{t("onStandNow")}</small><span className={`ap-num ${tone === "warn" ? "late" : tone} ltr`}>{left === null ? "—" : left >= 0 ? left : `+${-left}`}</span>
          <span className="ap-unit">{left === null ? t("noData") : left >= 0 ? t("unitLeft") : t("unitOver")}</span>{calm && <p className="ap-say">{calm}</p>}</>;

  return (
    <>
      <ApronStand otp={otp} lang={lang} tone={tone} calm head={head} idLabel={label} sel={sel} onSel={setSel} tag={tagOf} showDelays={false} showLog={!finished} />
      {finished && log}
    </>
  );
}
