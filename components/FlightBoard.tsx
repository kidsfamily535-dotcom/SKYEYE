import { Fragment } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { hm, type Board, type BoardRow, type BoardTab, type Phase, type Sla } from "@/lib/board";

const SLA_AR: Record<Sla, string> = { late: "متأخرة", risk: "معرّضة للتأخر", ok: "في الموعد", none: "بلا مهلة" };
const SLA_CLS: Record<Sla, string> = { late: "late", risk: "warn", ok: "ok", none: "mute" };
const PHASE_AR: Record<Phase, string> = { arrival: "وصول", turnaround: "على الأرض", departure: "مغادرة", done: "منتهية" };
const TABS: { key: BoardTab; label: string; count?: keyof Board["counts"] }[] = [
  { key: "all", label: "كل الرحلات", count: "all" },
  { key: "arrival", label: "وصول", count: "arrival" },
  { key: "turnaround", label: "على الأرض", count: "turnaround" },
  { key: "departure", label: "مغادرة", count: "departure" },
  { key: "done", label: "المنتهية" },
];

function Row({ r }: { r: BoardRow }) {
  return (
    <tr className={`fb-row ${r.stale ? "stale" : ""}`}>
      <td>
        <Link className="rowlink" href={`/flights?id=${r.rotationId}`}>
          <b>{r.airline && <Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} />} <span className="ltr">{r.flightIn ?? "—"}/{r.flightOut ?? "—"}</span></b>
        </Link>
        <small className="muted ltr">{r.registration ?? "—"}</small>
      </td>
      <td className="ltr route">{r.origin ?? "—"} → <b>{r.station ?? "—"}</b> → {r.destination ?? "—"}</td>
      <td className="ltr"><span>{hm(r.sta)}</span> <span className="sep">/</span> <span>{hm(r.std)}</span></td>
      <td className="ltr"><span>{hm(r.eta)}</span> <span className="sep">/</span> <span>{hm(r.etd)}</span></td>
      <td className="ltr"><span>{hm(r.ata)}</span> <span className="sep">/</span> <span>{hm(r.atd)}</span></td>
      <td>
        <span className={`phase ${r.phase}`}>{PHASE_AR[r.phase]}</span>
        <div>{r.stage}</div>
        {r.next && <small className="muted">التالي: {r.next}</small>}
      </td>
      <td><span className={`tag ${SLA_CLS[r.sla]}`}>{SLA_AR[r.sla]}</span></td>
      <td className="alert">{r.alert ?? <span className="muted">—</span>}</td>
    </tr>
  );
}

export default function FlightBoard({ board, tab, stationLabel }: { board: Board; tab: BoardTab; stationLabel: string }) {
  const c = board.counts;
  const hasToday = board.rows.some((r) => !r.stale);
  return (
    <>
      <section className="fb-head" aria-label="ملخص اليوم">
        <div>
          <small>SKYEYE — FLIGHT OPERATIONS</small>
          <h1>لوحة عمليات الرحلات المباشرة</h1>
          <span className="muted">{stationLabel} · كل الأوقات بتوقيت UTC</span>
        </div>
        <ul className="fb-kpis">
          <li><b>{c.todayTotal}</b><span>رحلات اليوم</span></li>
          <li className="ok"><b>{c.todayOnSchedule}</b><span>في الموعد</span></li>
          <li className="info"><b>{c.todayTurnaround}</b><span>على الأرض</span></li>
          <li className="warn"><b>{c.todayAttention}</b><span>تحتاج انتباهاً</span></li>
        </ul>
      </section>

      <div className="fb-grid">
        <section className="card fb" aria-label="جدول الرحلات">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <Link key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} href={t.key === "all" ? "/flights" : `/flights?tab=${t.key}`}>
                {t.label}{t.count ? <em className="cnt">{c[t.count]}</em> : null}
              </Link>
            ))}
            <Link className="btn gold sm fb-import" href="/flights/import">رفع برنامج الرحلات</Link>
          </div>

          {board.rows.length === 0 ? (
            <p className="muted">{tab === "done" ? "لا توجد رحلات منتهية." : tab === "all" ? "لا توجد رحلات حالية. ارفع برنامج الرحلات من الزر أعلاه." : "لا توجد رحلات في هذه المرحلة الآن."}</p>
          ) : (
            <div className="fb-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">الرحلة / REG</th>
                    <th scope="col">From → STN → To</th>
                    <th scope="col">STA / STD</th>
                    <th scope="col">ETA / ETD</th>
                    <th scope="col">ATA / ATD</th>
                    <th scope="col">المرحلة الحالية</th>
                    <th scope="col">SLA</th>
                    <th scope="col">تنبيه SKYEYE</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((r, i) => (
                    <Fragment key={r.rotationId}>
                      {tab !== "done" && ((i === 0 && !r.stale && hasToday) || (r.stale && (i === 0 || !board.rows[i - 1].stale))) && (
                        <tr className="grp"><th colSpan={8} scope="colgroup">{r.stale ? "متأخر إغلاقها (تاريخها قبل اليوم)" : "اليوم وما بعده"}</th></tr>
                      )}
                      <Row r={r} />
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {board.draftBasis && <p className="muted fb-note">حالة SLA تُحسب من مهل المراحل في قوالب لم تُعتمد بعد (مسودة)، فهي مؤشر تشغيلي لا التزام تعاقدي. المرحلة الحالية = آخر مرحلة مسجّلة.</p>}
        </section>

        <aside className="card fb-monitor" aria-label="SKYEYE Live Monitor">
          <h2>SKYEYE Live Monitor</h2>
          <small className="muted">أحداث تحتاج تدخلك الآن، مرتبة بالأهمية</small>
          {board.events.length === 0 ? (
            <p className="muted">لا أحداث تحتاج تدخلاً الآن.</p>
          ) : (
            <ul className="list">
              {board.events.slice(0, 12).map((e) => (
                <li key={e.id}>
                  <span className={`dot ${e.tone === "late" ? "late" : e.tone === "warn" ? "warn" : "info"}`} aria-hidden="true" />
                  <span>
                    <Link href={`/flights?id=${e.rotationId}`}><b className="ltr">{e.flight}</b></Link>
                    <small className="muted">{e.text}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {board.events.length > 12 && <small className="muted">و{board.events.length - 12} حدثاً آخر</small>}
          <small className="muted fb-note">تُشتق الأحداث من الأوقات والسجلات المسجّلة فقط. رسائل AD/AA MVT غير مربوطة بالمراقب بعد.</small>
        </aside>
      </div>
    </>
  );
}
