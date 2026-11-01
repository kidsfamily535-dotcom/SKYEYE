import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import FlightActions from "@/components/FlightActions";
import DelayForm from "@/components/DelayForm";
import { getCommandData } from "@/lib/data";
import { fmtUtc, hm } from "@/lib/format";
import { getFlight, getFlightList, type FlightRow } from "@/lib/flights";
import { FLIGHT_STATUS_AR } from "@/lib/labels";
import { PageHeader, Split, Tabs, Tag, Empty, ProgressBar } from "@/components/ui";

function Progress({ r }: { r: FlightRow }) {
  if (!r.stepsTotal) return <small className="muted">التقدم: —</small>;
  const pct = Math.round(((r.stepsRecorded ?? 0) / r.stepsTotal) * 100);
  return <ProgressBar pct={pct} label="مراحل المناولة المسجّلة" />;
}

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "active";
  const [d, list] = await Promise.all([getCommandData(), getFlightList(tab)]);
  const sel = sp.id ? await getFlight(sp.id) : list[0] ? await getFlight(list[0].rotationId) : null;
  const f = sel?.file; const c = sel?.clock;

  return (
    <Shell data={d}>
      <main className="page">
        <PageHeader title="الرحلات" subtitle="الدورانات الحالية بمراحلها، وأسئلة الوكيل، والخط الزمني لكل طائرة.">
          <Link className="btn gold sm" href="/flights/import">رفع برنامج الرحلات</Link>
        </PageHeader>
        <Split>
          <section className="card" aria-label="الرحلات">
            <Tabs items={[{ href: "/flights", label: "الحالية", active: tab === "active" }, { href: "/flights?tab=done", label: "المنتهية", active: tab === "done" }]} />
            {list.length === 0 && <Empty>{tab === "active" ? "لا توجد رحلات حالية. ارفع برنامج الرحلات من الزر أعلاه." : "لا توجد رحلات منتهية."}</Empty>}
            <ul className="list">
              {list.map((r) => (
                <li key={r.rotationId} className={r.rotationId === f?.rotation_id ? "cur" : ""}>
                  <Link className="item" href={`/flights?id=${r.rotationId}${tab === "done" ? "&tab=done" : ""}`} aria-current={r.rotationId === f?.rotation_id ? "true" : undefined}>
                    <b>{r.airline && <Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} />} <span className="ltr">{r.flightIn ?? "—"} ← → {r.flightOut ?? "—"}</span></b>
                    <small className="muted"><span className="ltr">{r.origin ?? "—"} → {r.station ?? "—"} → {r.destination ?? "—"}</span> · <span className="ltr">{r.registration ?? "—"}</span></small>
                    <small className="muted">وصول <span className="ltr">{hm(r.ata ?? r.eta ?? r.sta)}</span>{r.ata ? "" : r.eta ? " (متوقع)" : " (مجدول)"} · مغادرة <span className="ltr">{hm(r.atd ?? r.std)}</span> · {FLIGHT_STATUS_AR[r.status] ?? r.status}</small>
                    <Progress r={r} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="detail" aria-label="تفاصيل الرحلة">
            {!sel && <div className="card"><Empty>اختر رحلة لعرض خطها الزمني.</Empty></div>}
            {sel && f && c && (<>
              <div className="card">
                <div className="chips"><Tag tone={f.status === "delayed" ? "late" : "info"}>{FLIGHT_STATUS_AR[f.status] ?? f.status}</Tag>{Number(f.sop_critical_open) > 0 && <Tag tone="warn">مراحل حرجة مفتوحة: <span className="ltr">{String(f.sop_critical_open)}</span></Tag>}</div>
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
        </Split>
      </main>
    </Shell>
  );
}
