import Hint from "@/components/Hint";
import { getT } from "@/lib/lang";
import type { TFn } from "@/lib/i18n";
import { LEVEL_KEY, type Journey, type JourneyRow } from "@/lib/flight-journey";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const vr = (n: number | null, t: TFn) => (n === null ? null : `${n > 0 ? "+" : ""}${t("fl.min", { n })}`);

function Cell({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  if (!value) return null;
  return <div><dt>{label}</dt><dd className="ltr">{strong ? <b>{value}</b> : value}</dd></div>;
}

function Row({ r, t }: { r: JourneyRow; t: TFn }) {
  const v = vr(r.variance, t);
  return (
    <li className={`jrow lv-${r.level}`}>
      <i className={`dot ${r.level}`} aria-hidden="true" />
      <div className="jname"><b><bdi>{r.name}</bdi>{r.critical ? " ★" : ""}</b><small className="muted"><bdi>{r.status}</bdi>{r.code ? <> · <span className="ltr">{r.code}</span></> : null}</small></div>
      <dl className="jcells">
        <Cell label={t("fl.j.scheduled")} value={r.scheduled ? hm(r.scheduled) : null} />
        <Cell label={t("fl.j.predicted")} value={r.predicted ? hm(r.predicted) : null} />
        <Cell label={t("fl.j.target")} value={r.target ? hm(r.target) : null} />
        <Cell label={t("fl.j.actual")} value={r.actual ? hm(r.actual) : null} strong />
        {v && <div><dt>{r.varianceKind === "predicted" ? t("fl.j.varPred") : t("fl.j.var")}</dt><dd className="ltr">{v}</dd></div>}
      </dl>
    </li>
  );
}

export default async function FlightJourney({ j }: { j: Journey }) {
  const { t } = await getT();
  const d = j.departure;
  return (
    <section className="card jny" aria-label={t("fl.j.aria")}>
      <div className="jtop">
        <ol className="phases" aria-label={t("fl.j.phases.aria")}>
          {j.phases.map((p) => <li key={p.key} className={p.state} aria-current={p.state === "current" ? "step" : undefined}><i aria-hidden="true" /><span>{p.label}</span></li>)}
        </ol>
        <span className={`tag ${j.overall}`}>{j.cancelled ? t("fl.j.cancelled") : t(LEVEL_KEY[j.overall])}</span>
      </div>

      <div className={`dint lv-${d.level}`}>
        <div className="dhead"><small className="muted">{t("fl.j.etdTitle")}</small><b>{d.headline}</b></div>
        <dl className="jcells">
          <Cell label={t("fl.j.std")} value={d.std ? hm(d.std) : null} />
          <Cell label={t("fl.j.etd")} value={d.expected ? hm(d.expected) : null} strong />
          <Cell label={t("fl.j.actual")} value={d.atd ? hm(d.atd) : null} strong />
        </dl>
        {d.action && <p className="dact">{d.action}</p>}
      </div>

      <h2>{t("fl.j.events")}<Hint>{t("fl.j.hint")}</Hint></h2>
      <ul className="jrows">{j.rows.map((r) => <Row key={r.id} r={r} t={t} />)}</ul>
    </section>
  );
}
