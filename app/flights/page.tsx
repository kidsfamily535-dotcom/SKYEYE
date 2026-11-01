import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import FlightBoard from "@/components/FlightBoard";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import FlightActions from "@/components/FlightActions";
import DelayForm from "@/components/DelayForm";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { getBoard, type BoardTab } from "@/lib/board";
import { getFlight } from "@/lib/flights";

const STATUS_AR: Record<string, string> = { scheduled: "مجدولة", delayed: "متأخرة", arrived: "وصلت", departed: "غادرت", cancelled: "ملغاة", diverted: "محوّلة" };
const TABS = new Set<BoardTab>(["all", "arrival", "turnaround", "departure", "done"]);

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string; q?: string; day?: string }> }) {
  const sp = await searchParams;
  const d = await getCommandData();

  // Flight Profile — فتح رحلة واحدة: كل مراحلها وأسئلة الوكيل والإفادات
  if (sp.id) {
    const sel = await getFlight(sp.id);
    const f = sel?.file; const c = sel?.clock;
    return (
      <Shell data={d}>
        <main className="page">
          <div className="row"><Link className="btn sm" href="/flights">← لوحة الرحلات</Link></div>
          {!sel || !f || !c ? <div className="card"><p className="muted">لم يُعثر على الرحلة، أو لا تملك صلاحية عرضها.</p></div> : (
            <section className="detail" aria-label="ملف الرحلة">
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
            </section>
          )}
        </main>
      </Shell>
    );
  }

  // Flight Board — الشاشة الرئيسية
  const tab: BoardTab = TABS.has(sp.tab as BoardTab) ? (sp.tab as BoardTab) : "all";
  const q = (sp.q ?? "").slice(0, 40); const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? (sp.day as string) : "";
  const board = await getBoard(tab, { q, day });
  return (
    <Shell data={d}>
      <main className="page">
        <FlightBoard board={board} tab={tab} stationLabel={`${d.company.name} · LIVE OPERATIONS`} q={q} day={day} />
      </main>
    </Shell>
  );
}
