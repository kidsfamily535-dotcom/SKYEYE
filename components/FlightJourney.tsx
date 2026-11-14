import { getT } from "@/lib/lang";
import { LEVEL_KEY, type Journey } from "@/lib/flight-journey";

/** Phase strip only (before arrival / on the ground / departed) + overall level. Times live in the OTP card and the chronology, not here. */
export default async function FlightJourney({ j }: { j: Journey }) {
  const { t } = await getT();
  return (
    <section className="card jny" aria-label={t("fl.j.aria")}>
      <div className="jtop">
        <ol className="phases" aria-label={t("fl.j.phases.aria")}>
          {j.phases.map((p) => <li key={p.key} className={p.state} aria-current={p.state === "current" ? "step" : undefined}><i aria-hidden="true" /><span>{p.label}</span></li>)}
        </ol>
        <span className={`tag ${j.overall}`}>{j.cancelled ? t("fl.j.cancelled") : t(LEVEL_KEY[j.overall])}</span>
      </div>
    </section>
  );
}
