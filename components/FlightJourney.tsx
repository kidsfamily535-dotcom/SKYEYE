import Hint from "@/components/Hint";
import { LEVEL_AR, type Journey, type JourneyRow } from "@/lib/flight-journey";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const vr = (n: number | null) => (n === null ? null : `${n > 0 ? "+" : ""}${n} د`);

function Cell({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  if (!value) return null;
  return <div><dt>{label}</dt><dd className="ltr">{strong ? <b>{value}</b> : value}</dd></div>;
}

function Row({ r }: { r: JourneyRow }) {
  const v = vr(r.variance);
  return (
    <li className={`jrow lv-${r.level}`}>
      <i className={`dot ${r.level}`} aria-hidden="true" />
      <div className="jname"><b><bdi>{r.name}</bdi>{r.critical ? " ★" : ""}</b><small className="muted"><bdi>{r.status}</bdi>{r.code ? <> · <span className="ltr">{r.code}</span></> : null}</small></div>
      <dl className="jcells">
        <Cell label="المجدول" value={r.scheduled ? hm(r.scheduled) : null} />
        <Cell label="المتوقع" value={r.predicted ? hm(r.predicted) : null} />
        <Cell label="الهدف" value={r.target ? hm(r.target) : null} />
        <Cell label="الفعلي" value={r.actual ? hm(r.actual) : null} strong />
        {v && <div><dt>{r.varianceKind === "predicted" ? "الفرق المتوقع" : "الفرق"}</dt><dd className="ltr">{v}</dd></div>}
      </dl>
    </li>
  );
}

export default function FlightJourney({ j }: { j: Journey }) {
  const d = j.departure;
  return (
    <section className="card jny" aria-label="مسار الرحلة">
      <div className="jtop">
        <ol className="phases" aria-label="مرحلة الرحلة">
          {j.phases.map((p) => <li key={p.key} className={p.state} aria-current={p.state === "current" ? "step" : undefined}><i aria-hidden="true" /><span>{p.label}</span></li>)}
        </ol>
        <span className={`tag ${j.overall}`}>{j.cancelled ? "ملغاة" : LEVEL_AR[j.overall]}</span>
      </div>

      <div className={`dint lv-${d.level}`}>
        <div className="dhead"><small className="muted">توقع المغادرة</small><b>{d.headline}</b></div>
        <dl className="jcells">
          <Cell label="STD المجدول" value={d.std ? hm(d.std) : null} />
          <Cell label="ETD المتوقع" value={d.expected ? hm(d.expected) : null} strong />
          <Cell label="الفعلي" value={d.atd ? hm(d.atd) : null} strong />
        </dl>
        {d.action && <p className="dact">{d.action}</p>}
      </div>

      <h2>أحداث الرحلة<Hint>المجدول من البرنامج، والمتوقع من آخر رسالة أو حساب الساعة الأرضية، والهدف من قالب المرحلة المعتمد، والفعلي ما سجّله الموظف. لا يظهر رقم ليس له مصدر. ألوان الأحداث غير المسجّلة: أخضر ضمن الوقت، أزرق خلال 30 دقيقة، برتقالي خلال 10 دقائق، أحمر بعد الموعد.</Hint></h2>
      <ul className="jrows">{j.rows.map((r) => <Row key={r.id} r={r} />)}</ul>
    </section>
  );
}
