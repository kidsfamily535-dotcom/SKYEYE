import { Fragment } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import FlightActions from "@/components/FlightActions";
import DelayForm from "@/components/DelayForm";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import { getFlight, getFlightList, type FlightRow } from "@/lib/flights";

const STATUS_AR: Record<string, string> = { scheduled: "مجدولة", delayed: "متأخرة", arrived: "وصلت", departed: "غادرت", cancelled: "ملغاة", diverted: "محوّلة" };
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

function Progress({ r }: { r: FlightRow }) {
  if (!r.stepsTotal) return <small className="muted">التقدم: —</small>;
  const pct = Math.round(((r.stepsRecorded ?? 0) / r.stepsTotal) * 100);
  return <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="مراحل المناولة المسجّلة"><i style={{ width: `${pct}%` }} /></div>;
}

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string; view?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "active";
  const view = ["timeline", "messages", "delay"].includes(sp.view ?? "") ? sp.view : "overview";
  const [d, list] = await Promise.all([getCommandData(), getFlightList(tab)]);
  const sel = sp.id ? await getFlight(sp.id) : list[0] ? await getFlight(list[0].rotationId) : null;
  const f = sel?.file; const c = sel?.clock;
  const vh = (v: string) => `/flights?id=${f?.rotation_id}${tab === "done" ? "&tab=done" : ""}${v === "overview" ? "" : `&view=${v}`}`;
  const views: [string, string][] = [["overview", `الحالة والأسئلة${sel && sel.questions.length ? ` (${sel.questions.length})` : ""}`], ["timeline", "الخط الزمني"], ["messages", "الرسائل"], ["delay", "إفادات التأخير"]];

  return (
    <Shell data={d}>
      <main className="page">
        <div className="inbox">
          <section className="card" aria-label="الرحلات">
            <div className="tabs" role="tablist">
              <Link role="tab" aria-selected={tab === "active"} className={tab === "active" ? "on" : ""} href="/flights">الحالية</Link>
              <Link role="tab" aria-selected={tab === "done"} className={tab === "done" ? "on" : ""} href="/flights?tab=done">المنتهية</Link>
            </div>
            <div className="row"><Link className="btn gold sm" href="/flights/import">رفع برنامج الرحلات</Link></div>
            {list.length === 0 && <p className="muted">{tab === "active" ? "لا توجد رحلات حالية. ارفع برنامج الرحلات من الزر أعلاه." : "لا توجد رحلات منتهية."}</p>}
            <ul className="list">
              {list.map((r, i) => (<Fragment key={r.rotationId}>
                {tab === "active" && ((i === 0 && !r.stale) || (r.stale && (i === 0 || !list[i - 1].stale))) && (
                  <li className="grp" aria-hidden="true">{r.stale ? "متأخر إغلاقها (تاريخها قبل اليوم)" : "اليوم وما بعده"}</li>
                )}
                <li className={r.rotationId === f?.rotation_id ? "cur" : ""}>
                  <Link className="item" href={`/flights?id=${r.rotationId}${tab === "done" ? "&tab=done" : ""}`} aria-current={r.rotationId === f?.rotation_id ? "true" : undefined}>
                    <b>{r.airline && <Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} />} <span className="ltr">{r.flightIn ?? "—"} ← → {r.flightOut ?? "—"}</span></b>
                    <small className="muted"><span className="ltr">{r.origin ?? "—"} → {r.station ?? "—"} → {r.destination ?? "—"}</span> · <span className="ltr">{r.registration ?? "—"}</span></small>
                    <small className="muted">وصول <span className="ltr">{hm(r.ata ?? r.eta ?? r.sta)}</span>{r.ata ? "" : r.eta ? " (متوقع)" : " (مجدول)"} · مغادرة <span className="ltr">{hm(r.atd ?? r.std)}</span> · {STATUS_AR[r.status] ?? r.status}</small>
                    <Progress r={r} />
                  </Link>
                </li>
              </Fragment>))}
            </ul>
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

              <div className="tabs views" role="tablist" aria-label="أقسام الرحلة">
                {views.map(([v, label]) => <Link key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} href={vh(v)}>{label}</Link>)}
              </div>

              {view === "overview" && <div className="card"><h2>أسئلة الوكيل<Hint>لا يسأل الوكيل عن مرحلة إلا إذا اعتُمدت مهلتها. المراحل بلا مهلة معتمدة تُسجَّل يدوياً من الخط الزمني.</Hint></h2>
                <FlightQuestions questions={sel.questions} canAct={sel.canAct} />
              </div>}

              {view === "messages" && <FlightActions companyId={d.company.id} types={sel.messageTypes} canAct={sel.canAct}
                legs={[{ id: sel.arrivalLeg, label: String(f.flight_in ?? "arrival") }, { id: sel.departureLeg, label: String(f.flight_out ?? "departure") }]} />}

              {view === "timeline" && <div className="card"><h2>الخط الزمني</h2>
                <FlightTimeline steps={sel.steps} arrivalLeg={sel.arrivalLeg} canAct={sel.canAct} />
              </div>}

              {view === "delay" && <div className="card"><h2>إفادات التأخير</h2>
                <DelayForm flightId={sel.departureLeg} steps={sel.steps} codes={sel.delayCodes} statements={sel.statements} canAct={sel.canAct} />
              </div>}
            </>)}
          </section>
        </div>
      </main>
    </Shell>
  );
}
