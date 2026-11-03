"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { dict, type Key } from "@/lib/i18n";
import { fmtUtc } from "@/lib/format";
import { useT } from "./I18n";

export type BellAlert = { id: string; level: string; state: string; ruleCode: string | null; ruleNameAr: string | null; reasonAr: string; flightNumber: string | null; flightId: string | null; dueAt: string | null };
const MAX = 5;

/** Bell with a dropdown of the open alerts. Badge = alerts that still need a person (open or seen, not snoozed). Shift handover stays one tap away. */
export default function AlertBell({ alerts, total, pendingReports }: { alerts: BellAlert[]; total: number; pendingReports: number }) {
  const { t, lang } = useT();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (e: Event) => { const d = ref.current; if (d?.open && !(e.target instanceof Node && d.contains(e.target))) d.open = false; };
    const esc = (e: KeyboardEvent) => { const d = ref.current; if (e.key === "Escape" && d?.open) { d.open = false; d.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, []);
  const count = total + pendingReports;
  const label = total > 0 ? t("fa.bell", { n: total }) : pendingReports > 0 ? t("shell.handoverPending", { n: pendingReports }) : t("fa.bellNone");
  const name = (a: BellAlert) => (a.ruleCode && `fa.rule.${a.ruleCode}` in dict.en ? dict[lang][`fa.rule.${a.ruleCode}` as Key] : (a.ruleNameAr ?? a.ruleCode ?? ""));
  const critical = alerts.some((a) => a.level === "L4" || a.level === "L3");
  return (
    <details className="bellbox" ref={ref}>
      <summary className={`bell ${critical ? "hot" : ""}`} aria-label={label} title={label}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 19.5a2 2 0 0 0 4 0" /></svg>
        {count > 0 && <b className="badge">{count}</b>}
      </summary>
      <div className="bellpanel" role="region" aria-label={t("fa.panelTitle")}>
        <h2>{t("fa.panelTitle")}</h2>
        {alerts.length === 0 && <p className="muted">{t("fa.empty")}</p>}
        <ul>
          {alerts.slice(0, MAX).map((a) => (
            <li key={a.id}>
              <Link href="/alerts" onClick={() => { if (ref.current) ref.current.open = false; }}>
                <span className={`lvl ${a.level === "L1" ? "info" : a.level === "L2" ? "warn" : "late"}`}>{a.level}</span>
                <span className="bt">
                  <strong {...(lang === "en" && !(a.ruleCode && `fa.rule.${a.ruleCode}` in dict.en) ? { lang: "ar", dir: "rtl" } : {})}>{name(a)}</strong>
                  <small>{a.flightNumber ? <bdi className="ltr">{a.flightNumber}</bdi> : null}{a.flightNumber && a.dueAt ? " · " : ""}{a.dueAt ? <bdi className="ltr">{fmtUtc(a.dueAt)}</bdi> : null}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {alerts.length > MAX && <p className="muted">{t("fa.more", { n: alerts.length - MAX })}</p>}
        <div className="row">
          <Link href="/alerts" className="btn gold sm" onClick={() => { if (ref.current) ref.current.open = false; }}>{t("fa.viewAll")}</Link>
          <Link href="/handover" className="btn sm" onClick={() => { if (ref.current) ref.current.open = false; }}>{t("shell.handover")}{pendingReports > 0 ? ` (${pendingReports})` : ""}</Link>
        </div>
      </div>
    </details>
  );
}
