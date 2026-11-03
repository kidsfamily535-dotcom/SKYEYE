"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { acknowledgeAlert, resolveAlert, snoozeAlert } from "@/app/alerts/actions";
import { fmtUtc } from "@/lib/format";
import { dict, type Key } from "@/lib/i18n";
import type { FlightAlert } from "@/lib/alerts";
import { useT } from "./I18n";

const TONE: Record<string, string> = { L1: "info", L2: "warn", L3: "late", L4: "late" };
const SNOOZE_MIN = [15, 30, 60];

/** Rule name: the translated one when it exists, else the name stored in the database (Arabic). */
function ruleName(lang: "ar" | "en", code: string | null, nameAr: string | null): string {
  const k = `fa.rule.${code}`;
  if (code && k in dict.en) return dict[lang][k as Key];
  return nameAr ?? code ?? "";
}

export default function AlertCard({ a, canWrite, compact = false }: { a: FlightAlert; canWrite: boolean; compact?: boolean }) {
  const { t, lang } = useT();
  const [mode, setMode] = useState<"idle" | "snooze" | "resolve">("idle");
  const [minutes, setMinutes] = useState(30);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const closed = a.state === "resolved";
  const critical = a.level === "L4";

  const run = (fn: () => Promise<{ ok: true } | { ok: false; message: string }>) =>
    start(async () => { const r = await fn(); if (r.ok) { setMode("idle"); setText(""); setMsg(null); } else setMsg(r.message); });

  const ev = (e: FlightAlert["log"][number]) => {
    const k = `fa.ev.${e.event}`;
    const d = e.details;
    const vars = { who: e.actor ?? "—", from: String(d.from ?? "—"), to: String(d.to ?? "—"), event: e.event };
    const label = k in dict.en ? t(k as Key, vars) : t("fa.ev.other", vars);
    const extra = typeof d.reason === "string" ? d.reason : typeof d.note === "string" ? d.note : null;
    return { label, extra };
  };

  return (
    <article className={`acard lv-${a.level} st-${a.state}`} aria-label={ruleName(lang, a.ruleCode, a.ruleNameAr)}>
      <header className="ahead">
        <span className={`lvl ${TONE[a.level]}`}>{a.level} · {t(`fa.level.${a.level}` as Key)}</span>
        <span className="astate">
          {a.state === "snoozed" ? t("fa.snoozedUntil", { t: fmtUtc(a.snoozedUntil) }) : t(`fa.state.${a.state}` as Key)}
        </span>
        <span className="grow" />
        {a.flightId && a.flightNumber && (
          <Link className="btn ghost sm" href={`/flights?id=${a.flightId}`}>{t("fa.flight", { n: a.flightNumber })}</Link>
        )}
      </header>
      <h3 className="atitle" {...(lang === "en" && !(a.ruleCode && `fa.rule.${a.ruleCode}` in dict.en) ? { lang: "ar", dir: "rtl" } : {})}>{ruleName(lang, a.ruleCode, a.ruleNameAr)}</h3>
      <p className="areason" lang="ar" dir="rtl">{a.reasonAr}</p>
      {a.actionAr && !closed && (
        <p className="aaction"><b>{t("fa.action")}</b><span lang="ar" dir="rtl">{a.actionAr}</span></p>
      )}
      <p className="ameta">
        {a.dueAt && <span>{t("fa.due")}: <bdi className="ltr">{fmtUtc(a.dueAt)}</bdi></span>}
        <span>{t("fa.raisedAt")}: <bdi className="ltr">{fmtUtc(a.createdAt)}</bdi></span>
      </p>
      {closed && a.resolutionNote && <p className="aresolved">{t("fa.resolvedBy", { note: a.resolutionNote })}</p>}

      {!closed && canWrite && mode === "idle" && (
        <div className="row">
          {a.state === "open" && (
            <button type="button" className="btn gold" disabled={pending} onClick={() => run(() => acknowledgeAlert(a.companyId, a.id))}>{t("fa.btn.ack")}</button>
          )}
          {!critical && <button type="button" className="btn" disabled={pending} onClick={() => { setMsg(null); setMode("snooze"); }}>{t("fa.btn.snooze")}</button>}
          <button type="button" className={`btn ${a.state === "open" ? "ghost" : "gold"}`} disabled={pending} onClick={() => { setMsg(null); setMode("resolve"); }}>{t("fa.btn.resolve")}</button>
        </div>
      )}
      {!closed && canWrite && critical && mode === "idle" && <p className="muted">{t("fa.noSnooze")}</p>}

      {mode === "snooze" && (
        <div className="open-form">
          <label>{t("fa.snooze.minutes")}
            <select className="pick" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {SNOOZE_MIN.map((m) => <option key={m} value={m}>{t("fa.snooze.min", { n: m })}</option>)}
            </select>
          </label>
          <label>{t("fa.snooze.reason")}<textarea rows={2} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></label>
          {msg && <p role="alert" className="err">{msg}</p>}
          <div className="row">
            <button type="button" className="btn gold" disabled={pending || text.trim().length < 3} onClick={() => run(() => snoozeAlert(a.companyId, a.id, minutes, text))}>{t("fa.snooze.confirm")}</button>
            <button type="button" className="btn ghost" disabled={pending} onClick={() => { setMode("idle"); setText(""); setMsg(null); }}>{t("fa.btn.cancel")}</button>
          </div>
        </div>
      )}
      {mode === "resolve" && (
        <div className="open-form">
          <label>{t("fa.resolve.note")}<textarea rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} /></label>
          {msg && <p role="alert" className="err">{msg}</p>}
          <div className="row">
            <button type="button" className="btn gold" disabled={pending || text.trim().length < 3} onClick={() => run(() => resolveAlert(a.companyId, a.id, text))}>{t("fa.resolve.confirm")}</button>
            <button type="button" className="btn ghost" disabled={pending} onClick={() => { setMode("idle"); setText(""); setMsg(null); }}>{t("fa.btn.cancel")}</button>
          </div>
        </div>
      )}
      {mode === "idle" && msg && <p role="alert" className="err">{msg}</p>}

      {!compact && a.log.length > 0 && (
        <details className="fold ahist">
          <summary className="btn ghost sm">{t("fa.history")} ({a.log.length})</summary>
          <ol className="alog">
            {a.log.map((e) => { const x = ev(e); return (
              <li key={e.id}><bdi className="ltr">{fmtUtc(e.at)}</bdi><span>{x.label}{x.extra ? <em lang="en" dir="ltr"> — {x.extra}</em> : null}</span></li>
            ); })}
          </ol>
        </details>
      )}
    </article>
  );
}
