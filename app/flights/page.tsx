import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import FlightActions from "@/components/FlightActions";
import DelayForm from "@/components/DelayForm";
import FlightList from "@/components/FlightList";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { FLIGHT_STATUS_AR as STATUS_AR } from "@/lib/flight-labels";
import { getFlight, getFlightList, getTodayFlights } from "@/lib/flights";

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string }> }) {
  const sp = await searchParams;
  // Today (UTC day, nearest first, with each flight's next step) is the default view; the old lists stay one tab away.
  const tab = sp.tab === "done" ? "done" : sp.tab === "active" ? "active" : "today";
  const [d, list] = await Promise.all([getCommandData(), tab === "today" ? getTodayFlights() : getFlightList(tab)]);
  const sel = sp.id ? await getFlight(sp.id) : list[0] ? await getFlight(list[0].rotationId) : null;
  const f = sel?.file; const c = sel?.clock;

  return (
    <Shell data={d} scope="flights" agent={sel && c ? { targetType: "flight", targetId: sel.departureLeg, label: String(f?.flight_out ?? f?.flight_in ?? "—") } : null}>
      <main className="page">
        <div className="inbox">
          <section className="card" aria-label="الرحلات">
            <div className="tabs wrap" role="tablist">
              <Link role="tab" aria-selected={tab === "today"} className={tab === "today" ? "on" : ""} href="/flights">اليوم</Link>
              <Link role="tab" aria-selected={tab === "active"} className={tab === "active" ? "on" : ""} href="/flights?tab=active">الحالية</Link>
              <Link role="tab" aria-selected={tab === "done"} className={tab === "done" ? "on" : ""} href="/flights?tab=done">المنتهية</Link>
            </div>
            {tab === "today" && <p className="muted">رحلات اليوم بتوقيت UTC، الأقرب أولاً، وتحت كل رحلة أقرب خطوة لها.</p>}
            <div className="row"><Link className="btn gold sm" href="/flights/import">رفع برنامج الرحلات</Link></div>
            {list.length === 0 && <p className="muted">{tab === "today" ? "لا توجد رحلات اليوم. ارفع برنامج الرحلات من الزر أعلاه أو افتح تبويب «الحالية»." : tab === "active" ? "لا توجد رحلات حالية. ارفع برنامج الرحلات من الزر أعلاه." : "لا توجد رحلات منتهية."}</p>}
            <FlightList rows={list} selectedId={f?.rotation_id} showNext={tab === "today"} hrefFor={(r) => `/flights?id=${r.rotationId}${tab === "today" ? "" : `&tab=${tab}`}`} />
          </section>

          <section className="detail" aria-label="تفاصيل الرحلة">
            {!sel && <div className="card"><p className="muted">اختر رحلة لعرض خطها الزمني.</p></div>}
            {sel && f && c && (<>
              <div className="card">
                <div className="chips"><span className={`tag ${f.status === "delayed" ? "late" : "info"}`}>{STATUS_AR[f.status] ?? f.status}</span>{Number(f.sop_critical_open) > 0 && <span className="tag warn">مراحل حرجة مفتوحة: <span className="ltr">{String(f.sop_critical_open)}</span></span>}</div>
                <h2>{sel.airline && <Logo url={sel.airline.logoUrl} code={sel.airline.code} name={sel.airline.name} />} <span className="ltr">{f.flight_in ?? "—"} / {f.flight_out ?? "—"}</span></h2>
                <p className="muted"><span className="ltr">{f.origin ?? "—"} → {f.station ?? "—"} → {f.destination ?? "—"}</span> · <span className="ltr">{f.registration ?? "—"}</span></p>
                {!sel.canAct && <p role="alert" className="err">حسابك غير مربوط بملف موظف، فلا يمكنك تسجيل أوقات أو إفادات. اطلب من المدير إضافتك.</p>}
                <dl className="facts">
                  <div><dt>وصول مجدول / فعلي</dt><dd className="ltr">{fmtUtc(f.sta)} / {fmtUtc(f.ata)}</dd></div>
                  <div><dt>مغادرة مجدولة</dt><dd className="ltr">{fmtUtc(f.std)}</dd></div>
                  <div><dt>المغادرة المتوقعة على الأرض</dt><dd className="ltr">{fmtUtc(c.expected_std)}</dd></div>
                  <div><dt>تأخر الوصول (دقيقة)</dt><dd className="ltr">{c.arrival_delay_min ?? "—"}</dd></div>
                  <div><dt>زمن الأرض المخطط (دقيقة)</dt><dd className="ltr">{c.planned_ground_minutes ?? "—"}</dd></div>
                  <div><dt>بدء الأرض الفعلي</dt><dd className="ltr">{fmtUtc(c.ground_start_actual)}</dd></div>
                </dl>
              </div>

              <div className="card"><h2>أسئلة الوكيل</h2>
                <FlightQuestions questions={sel.questions} canAct={sel.canAct} />
                <p className="muted">لا يسأل الوكيل عن مرحلة إلا إذا اعتُمدت مهلتها. المراحل بلا مهلة معتمدة تُسجَّل يدوياً من الخط الزمني.</p>
              </div>

              <FlightActions companyId={d.company.id} types={sel.messageTypes} canAct={sel.canAct}
                legs={[{ id: sel.arrivalLeg, label: String(f.flight_in ?? "arrival") }, { id: sel.departureLeg, label: String(f.flight_out ?? "departure") }]} />

              <div className="card"><h2>الخط الزمني</h2>
                <FlightTimeline steps={sel.steps} arrivalLeg={sel.arrivalLeg} canAct={sel.canAct} />
              </div>

              <div className="card"><h2>إفادات التأخير</h2>
                <DelayForm flightId={sel.departureLeg} steps={sel.steps} codes={sel.delayCodes} statements={sel.statements} canAct={sel.canAct} />
              </div>
            </>)}
          </section>
        </div>
      </main>
    </Shell>
  );
}
