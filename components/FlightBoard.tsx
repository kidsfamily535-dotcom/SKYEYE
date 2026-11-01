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
        <small className="muted ltr">{r.callIn ?? "—"}{r.callOut && r.callOut !== r.callIn ? ` / ${r.callOut}` : ""} · {r.registration ?? "—"}</small>
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

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export default function FlightBoard({ board, tab, stationLabel, q, day }: { board: Board; tab: BoardTab; stationLabel: string; q: string; day: string }) {
  const c = board.counts;
  const hasToday = board.rows.some((r) => !r.stale);
  const href = (t: BoardTab, over: { q?: string; day?: string } = {}) => {
    const p = new URLSearchParams();
    if (t !== "all") p.set("tab", t);
    const nq = over.q ?? q; const nd = over.day ?? day;
    if (nq) p.set("q", nq);
    if (nd) p.set("day", nd);
    const s = p.toString();
    return s ? `/flights?${s}` : "/flights";
  };
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
          <form className="fb-search" method="get" action="/flights" role="search" aria-label="بحث في الرحلات">
            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
            <label><span className="sr">رقم الرحلة أو التسجيل</span><input className="ltr" type="search" name="q" defaultValue={q} placeholder="كود الشركة + الرقم: NE231 · MS777 · ABY553 · SU-GDA" autoComplete="off" /></label>
            <label><span className="sr">اليوم</span><input type="date" name="day" defaultValue={day} /></label>
            <button className="btn gold sm" type="submit">بحث</button>
            <Link className={`btn sm ${day === isoDay(0) ? "on" : ""}`} href={href(tab, { day: isoDay(0) })}>اليوم</Link>
            <Link className={`btn sm ${day === isoDay(1) ? "on" : ""}`} href={href(tab, { day: isoDay(1) })}>غداً</Link>
            {board.filtered && <Link className="btn sm" href={href(tab, { q: "", day: "" })}>مسح البحث</Link>}
          </form>
          {board.qNeedsCode && <p role="status" className="fb-hint">رقم الرحلة يبدأ دائماً بكود الشركة (call sign) مثل <span className="ltr">NE{q}</span> أو <span className="ltr">MS{q}</span>. اكتب الكود قبل الرقم ثم ابحث.</p>}
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <Link key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "on" : ""} href={href(t.key)}>
                {t.label}{t.count ? <em className="cnt">{c[t.count]}</em> : null}
              </Link>
            ))}
            <Link className="btn gold sm fb-import" href="/flights/import">رفع برنامج الرحلات</Link>
          </div>

          {board.rows.length === 0 ? (
            <p className="muted">{board.filtered ? "لا توجد رحلات تطابق البحث. جرّب رقماً أقصر (مثل 231) أو يوماً آخر، أو امسح البحث." : tab === "done" ? "لا توجد رحلات منتهية." : tab === "all" ? "لا توجد رحلات حالية. ارفع برنامج الرحلات من الزر أعلاه." : "لا توجد رحلات في هذه المرحلة الآن."}</p>
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
                      {tab !== "done" && !board.filtered && ((i === 0 && !r.stale && hasToday) || (r.stale && (i === 0 || !board.rows[i - 1].stale))) && (
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
