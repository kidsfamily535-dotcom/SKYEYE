import Link from "next/link";
import Shell from "@/components/Shell";
import ProgramImport from "@/components/ProgramImport";
import { getCommandData } from "@/lib/data";
import { getImportContext } from "@/lib/program";
import { getT } from "@/lib/lang";

export default async function ImportPage() {
  const { t } = await getT();
  const [d, c] = await Promise.all([getCommandData(), getImportContext()]);
  return (
    <Shell data={d}>
      <main className="page">
        <section className="card" aria-label={t("imp.title")}>
          <div className="row"><h2 className="grow">{t("imp.title")}</h2><Link className="btn sm" href="/flights">{t("imp.back")}</Link></div>
          {!c && <p className="muted">{t("home.noMembership")}</p>}
          {c && !c.canWrite && <p role="alert" className="err">{t("imp.viewOnly")}</p>}
          {c && c.canWrite && <ProgramImport canAdmin={c.canAdmin} />}
        </section>
        {c && c.canWrite && (
          <section className="card" aria-label={t("imp.config.title")}>
            <h2>{t("imp.config.title")}</h2>
            <small className="muted">{t("imp.config.note")}</small>
            <p>{t("imp.stations")} <span className="ltr">{c.stations.length ? c.stations.join(" ") : "—"}</span></p>
            <p>{t("imp.airlines")} <span className="ltr">{c.airlines.length ? c.airlines.join(" ") : "—"}</span></p>
          </section>
        )}
      </main>
    </Shell>
  );
}
