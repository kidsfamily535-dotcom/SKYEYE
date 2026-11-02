import Link from "next/link";
import Shell from "@/components/Shell";
import ShiftAck from "@/components/ShiftAck";
import Hint from "@/components/Hint";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { getShiftPage } from "@/lib/shifts";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

const dash = (n: number | null) => (n === null ? "—" : String(n));
const SEV_TONE = (s: string) => (s === "high" ? "late" : "warn");

export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ id?: string; view?: string }> }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const rng = lang === "ar" ? "←" : "→";
  const Q = (s: string) => (["asked", "in_progress", "late", "escalated"].includes(s) ? t(`q.${s}` as Key) : s);
  const ALERT_ST = (s: string) => (["open", "acknowledged"].includes(s) ? t(`alert.${s}` as Key) : s);
  const view = ["requests", "flights", "mail"].includes(sp.view ?? "") ? sp.view : "overview";
  const [d, p] = await Promise.all([getCommandData(), getShiftPage(sp.id)]);

  return (
    <Shell data={d}>
      <main className="page">
        {!p && <section className="card"><p className="muted">{t("home.noMembership")}</p></section>}
        {p && (
          <>
            {p.defs.length === 0
              ? <section className="card"><p>{t("hv.noDefs")}</p></section>
              : p.nextReports[0] && <p className="muted">{t("hv.next.pre")} <bdi>{p.nextReports[0].name}</bdi> {t("hv.next.gen")} <span className="ltr">{fmtUtc(p.nextReports[0].generateAt)}</span> · {t("hv.next.end")} <span className="ltr">{fmtUtc(p.nextReports[0].shiftEnd)}</span></p>}

            <div className="inbox">
              <section className="card" aria-label={t("hv.reports")}>
                <h2>{t("hv.reports")}</h2>
                {p.reports.length === 0 && <p className="muted">{t("hv.reports.empty")}</p>}
                <ul className="list">
                  {p.reports.map((r) => (
                    <li key={r.id} className={r.id === p.sel?.id ? "cur" : ""}>
                      <Link className="item" href={`/handover?id=${r.id}`} aria-current={r.id === p.sel?.id ? "true" : undefined}>
                        <b><bdi>{r.shiftName}</bdi> <em className={`tag ${r.status === "generated" ? "warn" : "ok"}`}>{r.status === "generated" ? t("hv.status.pending") : t("hv.status.done")}</em></b>
                        <small className="muted"><span className="ltr">{fmtUtc(r.start)}</span> {rng} <span className="ltr">{fmtUtc(r.end)}</span></small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="detail" aria-label={t("hv.detail")}>
                {!p.sel && <div className="card"><p className="muted">{t("hv.pick")}</p></div>}
                {p.sel && (() => {
                  const r = p.sel; const c = r.content;
                  return (<>
                    <div className="card">
                      <div className="chips"><span className={`tag ${r.status === "generated" ? "warn" : "ok"}`}>{r.status === "generated" ? t("hv.status.pending") : t("hv.status.done")}</span></div>
                      <h2><bdi>{r.shiftName}</bdi><Hint>{t("hv.hint.snapshot")}</Hint></h2>
                      <p className="muted"><span className="ltr">{fmtUtc(r.start)}</span> {rng} <span className="ltr">{fmtUtc(r.end)}</span> · {t("hv.generatedBy")} <span className="ltr">{fmtUtc(r.generatedAt)}</span></p>
                      <ul className="stats">
                        <li><b className="ltr">{c.requests.length}</b>{t("hv.stat.requests")}</li>
                        <li><b className="ltr">{c.alerts.length}</b>{t("hv.stat.alerts")}</li>
                        <li><b className="ltr">{c.questions.length}</b>{t("hv.stat.questions")}</li>
                        <li><b className="ltr">{c.flights.length}</b>{t("hv.stat.flights")}</li>
                      </ul>
                    </div>


                    <div className="tabs views" role="tablist" aria-label={t("hv.tabs.aria")}>
                      {([["overview", r.status === "generated" ? t("hv.tab.ack") : t("hv.tab.ackDone")], ["requests", t("hv.tab.requests", { n: c.requests.length + c.alerts.length })], ["flights", t("hv.tab.flights", { n: c.flights.length + c.questions.length })], ["mail", t("hv.tab.mail")]] as [string, string][]).map(([v, label]) => <Link key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} href={`/handover?id=${r.id}${v === "overview" ? "" : `&view=${v}`}`}>{label}</Link>)}
                    </div>

                    {view === "overview" && <>
                    <div className="card"><h2>{t("hv.tab.ack")}</h2>
                      {r.status === "acknowledged" ? (
                        <>
                          <p>{t("hv.ack.by")} <b><bdi>{r.ackByName ?? "—"}</bdi></b> <span className="ltr">{fmtUtc(r.ackAt)}</span></p>
                          <p className="muted">{t("hv.ack.took")} <span className="ltr">{dash(r.tookCount)}</span></p>
                          {r.ackNote && <p className="note">{r.ackNote}</p>}
                        </>
                      ) : p.canWrite && p.hasEmployee ? <ShiftAck reportId={r.id} openCount={c.requests.length} />
                        : <p className="muted">{p.canWrite ? t("hv.ack.noEmp") : t("hv.ack.viewer")}</p>}
                    </div>
                    </>}

                    {view === "requests" && <>
                    <div className="card"><h2>{t("hv.req.open")}</h2>
                      {c.requests.length === 0 && <p className="muted">{t("hv.req.none")}</p>}
                      <ul className="list">{c.requests.map((q) => {
                        const lv = p.live.get(q.id);
                        return (
                          <li key={q.id}><i className={`dot ${q.urgent ? "late" : "info"}`} /><span>
                            <bdi>{q.title}</bdi>
                            <small className="muted"><span className="ltr">{q.flightRef ?? "—"}</span> · {q.stageLabel ?? q.stageLabelAr ?? "—"}{q.urgent ? ` · ${t("tone.late")}` : ""} · {t("hv.due")} <span className="ltr">{fmtUtc(q.dueAt)}</span></small>
                            <small className="muted">{t("hv.owner")} {q.ownerName ?? t("hv.unassigned")}</small>
                            {q.lastEventSummary && <small className="muted ltr">{q.lastEventSummary}</small>}
                            {lv && <small className="muted">{t("hv.now")} {lv.status === "open" ? `${lv.stageLabel ?? lv.stageLabelAr ?? "—"} · ${t("hv.ownerNow")} ${lv.ownerName ?? t("hv.unassigned")}` : lv.status === "closed" ? t("hv.closed") : t("hv.cancelled")}</small>}
                          </span></li>);
                      })}</ul>
                    </div>

                    <div className="card"><h2>{t("hv.alerts")}</h2>
                      {c.alerts.length === 0 && <p className="muted">{t("hv.alerts.none")}</p>}
                      <ul className="list">{c.alerts.map((a) => <li key={a.id}><i className={`dot ${SEV_TONE(a.severity)}`} /><span><bdi className="ltr">{a.title}</bdi><small className="muted"><span className="ltr">{fmtUtc(a.detectedAt)}</span> · {ALERT_ST(a.status)}</small></span></li>)}</ul>
                    </div>
                    </>}

                    {view === "flights" && <>
                    <div className="card"><h2>{t("hv.flights")}</h2>
                      {c.flights.length === 0 && <p className="muted">{t("hv.flights.none")}</p>}
                      <ul className="list">{c.flights.map((f) => <li key={f.key}><i className="dot info" /><span><b className="ltr">{f.flightIn ?? "—"} → {f.flightOut ?? "—"}</b><small className="muted"><span className="ltr">{f.registration ?? "—"}</span> · {t("hv.arrived")} <span className="ltr">{fmtUtc(f.ata)}</span> · {t("hv.plannedDep")} <span className="ltr">{fmtUtc(f.std)}</span></small></span></li>)}</ul>
                    </div>

                    <div className="card"><h2>{t("hv.q")}</h2>
                      {c.questions.length === 0 && <p className="muted">{t("hv.q.none")}</p>}
                      <ul className="list">{c.questions.map((q) => <li key={q.id}><i className={`dot ${q.status === "late" || q.status === "escalated" ? "late" : "warn"}`} /><span><b className="ltr">{q.flightNumber ?? "—"}</b> {q.questionAr ?? "—"}<small className="muted">{t("hv.due")} <span className="ltr">{fmtUtc(q.dueAt)}</span> · {Q(q.status)}</small></span></li>)}</ul>
                    </div>
                    </>}

                    {view === "mail" && <>
                    <div className="card"><h2>{t("hv.mail")}</h2>
                      <dl className="facts">
                        <div><dt>{t("hv.mail.new")}</dt><dd className="ltr">{dash(c.emails.new)}</dd></div>
                        <div><dt>{t("hv.mail.urgent")}</dt><dd className="ltr">{dash(c.emails.urgentNew)}</dd></div>
                        <div><dt>{t("hv.mail.drafts")}</dt><dd className="ltr">{dash(c.emails.draftsWaiting)}</dd></div>
                        <div><dt>{t("hv.mail.events")}</dt><dd className="ltr">{dash(c.during.events)}</dd></div>
                        <div><dt>{t("hv.mail.delays")}</dt><dd className="ltr">{dash(c.during.delays)}</dd></div>
                      </dl>
                    </div>
                    </>}
                  </>);
                })()}
              </section>
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}
