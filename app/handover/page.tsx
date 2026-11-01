import Link from "next/link";
import Shell from "@/components/Shell";
import ShiftAck from "@/components/ShiftAck";
import ShiftDefinitionForm from "@/components/ShiftDefinitionForm";
import { getCommandData } from "@/lib/data";
import { dash, fmtUtc } from "@/lib/format";
import { getShiftPage, hhmm } from "@/lib/shifts";
import { ALERT_STATUS_AR, QUESTION_STATUS_AR } from "@/lib/labels";
import { PageHeader, Split, Tag, Empty, NoCompany } from "@/components/ui";

const SEV_TONE = (s: string) => (s === "high" ? "late" : "warn");

export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const [d, p] = await Promise.all([getCommandData(), getShiftPage(sp.id)]);

  return (
    <Shell data={d}>
      <main className="page">
        <PageHeader title="تقرير الوردية" subtitle="لقطة نهاية كل وردية، والاستلام خطوة صريحة باسم من يستلم." />
        {!p && <NoCompany />}
        {p && (
          <>
            <section className="card" aria-label="الورديات">
              <h2>الورديات</h2>
              {p.defs.length === 0 && <p className="muted">لم تُعرَّف أي وردية بعد، فلا يُولَّد أي تقرير. لا أفترض مواعيد الوردية: يحددها المسؤول.</p>}
              <ul className="list">
                {p.defs.map((s) => (
                  <li key={s.id}><i className={`dot ${s.active ? "ok" : "info"}`} /><span><bdi>{s.name}</bdi><small className="muted">تبدأ <span className="ltr">{hhmm(s.startMinute)}</span> UTC · مدتها <span className="ltr">{Math.round((s.durationMinutes / 60) * 10) / 10}</span> ساعة{s.active ? "" : " · متوقفة"}</small></span></li>
                ))}
              </ul>
              {p.nextReports.length > 0 && (
                <ul className="list">
                  {p.nextReports.map((n) => (
                    <li key={n.name}><i className="dot info" /><span>التقرير القادم لـ <bdi>{n.name}</bdi><small className="muted">يُولَّد <span className="ltr">{fmtUtc(n.generateAt)}</span> · تنتهي الوردية <span className="ltr">{fmtUtc(n.shiftEnd)}</span></small></span></li>
                  ))}
                </ul>
              )}
              {p.canAdmin ? <details className="fold"><summary className="btn ghost sm">{p.defs.length === 0 ? "عرّف الوردية الأولى" : "أضف أو عدّل وردية"}</summary><ShiftDefinitionForm companyId={p.companyId} /></details>
                : p.defs.length === 0 && <p className="muted">اطلب من المسؤول تعريف الورديات.</p>}
            </section>

            <Split>
              <section className="card" aria-label="تقارير الوردية">
                <h2>تقارير الوردية</h2>
                {p.reports.length === 0 && <p className="muted">لا توجد تقارير بعد. أول تقرير يظهر قبل نهاية أول وردية معرّفة بـ 15 دقيقة.</p>}
                <ul className="list">
                  {p.reports.map((r) => (
                    <li key={r.id} className={r.id === p.sel?.id ? "cur" : ""}>
                      <Link className="item" href={`/handover?id=${r.id}`} aria-current={r.id === p.sel?.id ? "true" : undefined}>
                        <b><bdi>{r.shiftName}</bdi> <Tag tone={r.status === "generated" ? "warn" : "ok"}>{r.status === "generated" ? "بانتظار الاستلام" : "تم الاستلام"}</Tag></b>
                        <small className="muted"><span className="ltr">{fmtUtc(r.start)}</span> ← <span className="ltr">{fmtUtc(r.end)}</span></small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="detail" aria-label="تفاصيل التقرير">
                {!p.sel && <div className="card"><Empty>اختر تقريراً لعرضه.</Empty></div>}
                {p.sel && (() => {
                  const r = p.sel; const c = r.content;
                  return (<>
                    <div className="card">
                      <div className="chips"><Tag tone={r.status === "generated" ? "warn" : "ok"}>{r.status === "generated" ? "بانتظار الاستلام" : "تم الاستلام"}</Tag></div>
                      <h2><bdi>{r.shiftName}</bdi></h2>
                      <p className="muted"><span className="ltr">{fmtUtc(r.start)}</span> ← <span className="ltr">{fmtUtc(r.end)}</span> · ولّده الوكيل <span className="ltr">{fmtUtc(r.generatedAt)}</span></p>
                      <p className="muted">هذه لقطة لحظة التوليد؛ قسم «الآن» يوضح حال كل طلب اليوم.</p>
                      <ul className="stats">
                        <li><b className="ltr">{c.requests.length}</b>طلب مفتوح</li>
                        <li><b className="ltr">{c.alerts.length}</b>تنبيه قائم</li>
                        <li><b className="ltr">{c.questions.length}</b>سؤال بلا إجابة</li>
                        <li><b className="ltr">{c.flights.length}</b>طائرة على الأرض</li>
                      </ul>
                    </div>

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
                      <ul className="list">{c.alerts.map((a) => <li key={a.id}><i className={`dot ${SEV_TONE(a.severity)}`} /><span><bdi className="ltr">{a.title}</bdi><small className="muted"><span className="ltr">{fmtUtc(a.detectedAt)}</span> · {ALERT_STATUS_AR[a.status] ?? a.status}</small></span></li>)}</ul>
                    </div>

                    <div className="card"><h2>أسئلة الوكيل بلا إجابة</h2>
                      {c.questions.length === 0 && <p className="muted">لا أسئلة معلّقة.</p>}
                      <ul className="list">{c.questions.map((q) => <li key={q.id}><i className={`dot ${q.status === "late" || q.status === "escalated" ? "late" : "warn"}`} /><span><b className="ltr">{q.flightNumber ?? "—"}</b> {q.questionAr ?? "—"}<small className="muted">الموعد <span className="ltr">{fmtUtc(q.dueAt)}</span> · {QUESTION_STATUS_AR[q.status] ?? q.status}</small></span></li>)}</ul>
                    </div>

                    <div className="card"><h2>الطائرات على الأرض</h2>
                      {c.flights.length === 0 && <p className="muted">لا طائرات على الأرض وقت التوليد.</p>}
                      <ul className="list">{c.flights.map((f) => <li key={f.key}><i className="dot info" /><span><b className="ltr">{f.flightIn ?? "—"} → {f.flightOut ?? "—"}</b><small className="muted"><span className="ltr">{f.registration ?? "—"}</span> · وصلت <span className="ltr">{fmtUtc(f.ata)}</span> · المغادرة المخططة <span className="ltr">{fmtUtc(f.std)}</span></small></span></li>)}</ul>
                    </div>

                    <div className="card"><h2>البريد وما سُجّل أثناء الوردية</h2>
                      <dl className="facts">
                        <div><dt>إيميلات جديدة</dt><dd className="ltr">{dash(c.emails.new)}</dd></div>
                        <div><dt>منها عاجلة</dt><dd className="ltr">{dash(c.emails.urgentNew)}</dd></div>
                        <div><dt>مسودات بانتظار المراجعة</dt><dd className="ltr">{dash(c.emails.draftsWaiting)}</dd></div>
                        <div><dt>أحداث رحلات سُجّلت</dt><dd className="ltr">{dash(c.during.events)}</dd></div>
                        <div><dt>إفادات تأخير</dt><dd className="ltr">{dash(c.during.delays)}</dd></div>
                      </dl>
                    </div>

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
                  </>);
                })()}
              </section>
            </Split>
          </>
        )}
      </main>
    </Shell>
  );
}
