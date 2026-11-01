import Link from "next/link";
import Shell from "@/components/Shell";
import ShiftAck from "@/components/ShiftAck";
import Hint from "@/components/Hint";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { getShiftPage, hhmm } from "@/lib/shifts";

const dash = (n: number | null) => (n === null ? "—" : String(n));
const Q_AR: Record<string, string> = { asked: "مطروح", in_progress: "قيد المتابعة", late: "متأخر", escalated: "مُصعَّد" };
const SEV_TONE = (s: string) => (s === "high" ? "late" : "warn");
const ALERT_ST_AR: Record<string, string> = { open: "جديد", acknowledged: "تمت رؤيته" };

export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ id?: string; view?: string }> }) {
  const sp = await searchParams;
  const view = ["requests", "flights", "mail"].includes(sp.view ?? "") ? sp.view : "overview";
  const [d, p] = await Promise.all([getCommandData(), getShiftPage(sp.id)]);

  return (
    <Shell data={d}>
      <main className="page">
        {!p && <section className="card"><p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p></section>}
        {p && (
          <>
            {p.defs.length === 0
              ? <section className="card"><p>لم تُعرَّف أي وردية بعد، فلا يُولَّد أي تقرير. {p.canAdmin ? <Link href="/settings">عرّف الوردية الأولى من الإعدادات</Link> : "اطلب من المسؤول تعريف الورديات."}</p></section>
              : p.nextReports[0] && <p className="muted">التقرير القادم لـ <bdi>{p.nextReports[0].name}</bdi> يُولَّد <span className="ltr">{fmtUtc(p.nextReports[0].generateAt)}</span> · تنتهي الوردية <span className="ltr">{fmtUtc(p.nextReports[0].shiftEnd)}</span></p>}

            <div className="inbox">
              <section className="card" aria-label="تقارير الوردية">
                <h2>تقارير الوردية</h2>
                {p.reports.length === 0 && <p className="muted">لا توجد تقارير بعد. أول تقرير يظهر قبل نهاية أول وردية معرّفة بـ 15 دقيقة.</p>}
                <ul className="list">
                  {p.reports.map((r) => (
                    <li key={r.id} className={r.id === p.sel?.id ? "cur" : ""}>
                      <Link className="item" href={`/handover?id=${r.id}`} aria-current={r.id === p.sel?.id ? "true" : undefined}>
                        <b><bdi>{r.shiftName}</bdi> <em className={`tag ${r.status === "generated" ? "warn" : "ok"}`}>{r.status === "generated" ? "بانتظار الاستلام" : "تم الاستلام"}</em></b>
                        <small className="muted"><span className="ltr">{fmtUtc(r.start)}</span> ← <span className="ltr">{fmtUtc(r.end)}</span></small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="detail" aria-label="تفاصيل التقرير">
                {!p.sel && <div className="card"><p className="muted">اختر تقريراً لعرضه.</p></div>}
                {p.sel && (() => {
                  const r = p.sel; const c = r.content;
                  return (<>
                    <div className="card">
                      <div className="chips"><span className={`tag ${r.status === "generated" ? "warn" : "ok"}`}>{r.status === "generated" ? "بانتظار الاستلام" : "تم الاستلام"}</span></div>
                      <h2><bdi>{r.shiftName}</bdi><Hint>هذه لقطة لحظة التوليد؛ سطر «الآن» تحت كل طلب يوضح حاله اليوم.</Hint></h2>
                      <p className="muted"><span className="ltr">{fmtUtc(r.start)}</span> ← <span className="ltr">{fmtUtc(r.end)}</span> · ولّده الوكيل <span className="ltr">{fmtUtc(r.generatedAt)}</span></p>
                      <ul className="stats">
                        <li><b className="ltr">{c.requests.length}</b>طلب مفتوح</li>
                        <li><b className="ltr">{c.alerts.length}</b>تنبيه قائم</li>
                        <li><b className="ltr">{c.questions.length}</b>سؤال بلا إجابة</li>
                        <li><b className="ltr">{c.flights.length}</b>طائرة على الأرض</li>
                      </ul>
                    </div>


                    <div className="tabs views" role="tablist" aria-label="أقسام التقرير">
                      {([["overview", r.status === "generated" ? "الاستلام" : "الاستلام ✓"], ["requests", `الطلبات والتنبيهات (${c.requests.length + c.alerts.length})`], ["flights", `الرحلات والأسئلة (${c.flights.length + c.questions.length})`], ["mail", "البريد والأحداث"]] as [string, string][]).map(([v, label]) => <Link key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} href={`/handover?id=${r.id}${v === "overview" ? "" : `&view=${v}`}`}>{label}</Link>)}
                    </div>

                    {view === "overview" && <>
                    <div className="card"><h2>الاستلام</h2>
                      {r.status === "acknowledged" ? (
                        <>
                          <p>استلمها <b><bdi>{r.ackByName ?? "—"}</bdi></b> <span className="ltr">{fmtUtc(r.ackAt)}</span></p>
                          <p className="muted">طلبات استلمها باسمه: <span className="ltr">{dash(r.tookCount)}</span></p>
                          {r.ackNote && <p className="note">{r.ackNote}</p>}
                        </>
                      ) : p.canWrite && p.hasEmployee ? <ShiftAck reportId={r.id} openCount={c.requests.length} />
                        : <p className="muted">{p.canWrite ? "حسابك غير مربوط بملف موظف، فلا يمكنك الاستلام. اطلب من المسؤول إضافتك في الموظفين." : "صلاحية المشاهدة لا تسمح بالاستلام."}</p>}
                    </div>
                    </>}

                    {view === "requests" && <>
                    <div className="card"><h2>الطلبات المفتوحة</h2>
                      {c.requests.length === 0 && <p className="muted">لا طلبات مفتوحة وقت التوليد.</p>}
                      <ul className="list">{c.requests.map((q) => {
                        const lv = p.live.get(q.id);
                        return (
                          <li key={q.id}><i className={`dot ${q.urgent ? "late" : "info"}`} /><span>
                            <Link href={`/requests?id=${q.id}`}><bdi>{q.title}</bdi></Link>
                            <small className="muted"><span className="ltr">{q.flightRef ?? "—"}</span> · {q.stageLabelAr ?? "—"}{q.urgent ? " · عاجل" : ""} · الموعد <span className="ltr">{fmtUtc(q.dueAt)}</span></small>
                            <small className="muted">المسؤول: {q.ownerName ?? "غير مسند"}</small>
                            {q.lastEventSummary && <small className="muted ltr">{q.lastEventSummary}</small>}
                            {lv && <small className="muted">الآن: {lv.status === "open" ? `${lv.stageLabelAr ?? "—"} · المسؤول ${lv.ownerName ?? "غير مسند"}` : lv.status === "closed" ? "اتقفل" : "اتلغى"}</small>}
                          </span></li>);
                      })}</ul>
                    </div>

                    <div className="card"><h2>التنبيهات القائمة</h2>
                      {c.alerts.length === 0 && <p className="muted">لا تنبيهات قائمة.</p>}
                      <ul className="list">{c.alerts.map((a) => <li key={a.id}><i className={`dot ${SEV_TONE(a.severity)}`} /><span><bdi className="ltr">{a.title}</bdi><small className="muted"><span className="ltr">{fmtUtc(a.detectedAt)}</span> · {ALERT_ST_AR[a.status] ?? a.status}</small></span></li>)}</ul>
                    </div>
                    </>}

                    {view === "flights" && <>
                    <div className="card"><h2>الطائرات على الأرض</h2>
                      {c.flights.length === 0 && <p className="muted">لا طائرات على الأرض وقت التوليد.</p>}
                      <ul className="list">{c.flights.map((f) => <li key={f.key}><i className="dot info" /><span><b className="ltr">{f.flightIn ?? "—"} → {f.flightOut ?? "—"}</b><small className="muted"><span className="ltr">{f.registration ?? "—"}</span> · وصلت <span className="ltr">{fmtUtc(f.ata)}</span> · المغادرة المخططة <span className="ltr">{fmtUtc(f.std)}</span></small></span></li>)}</ul>
                    </div>

                    <div className="card"><h2>أسئلة الوكيل بلا إجابة</h2>
                      {c.questions.length === 0 && <p className="muted">لا أسئلة معلّقة.</p>}
                      <ul className="list">{c.questions.map((q) => <li key={q.id}><i className={`dot ${q.status === "late" || q.status === "escalated" ? "late" : "warn"}`} /><span><b className="ltr">{q.flightNumber ?? "—"}</b> {q.questionAr ?? "—"}<small className="muted">الموعد <span className="ltr">{fmtUtc(q.dueAt)}</span> · {Q_AR[q.status] ?? q.status}</small></span></li>)}</ul>
                    </div>
                    </>}

                    {view === "mail" && <>
                    <div className="card"><h2>البريد وما سُجّل أثناء الوردية</h2>
                      <dl className="facts">
                        <div><dt>إيميلات جديدة</dt><dd className="ltr">{dash(c.emails.new)}</dd></div>
                        <div><dt>منها عاجلة</dt><dd className="ltr">{dash(c.emails.urgentNew)}</dd></div>
                        <div><dt>مسودات بانتظار المراجعة</dt><dd className="ltr">{dash(c.emails.draftsWaiting)}</dd></div>
                        <div><dt>أحداث رحلات سُجّلت</dt><dd className="ltr">{dash(c.during.events)}</dd></div>
                        <div><dt>إفادات تأخير</dt><dd className="ltr">{dash(c.during.delays)}</dd></div>
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
