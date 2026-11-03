import Shell from "@/components/Shell";
import AlertCard from "@/components/AlertCard";
import { getCommandData } from "@/lib/data";
import { getAlerts } from "@/lib/alerts";
import { getT } from "@/lib/lang";

export default async function AlertsPage() {
  const { t } = await getT();
  const [d, al] = await Promise.all([getCommandData(), getAlerts()]);
  return (
    <Shell data={d}>
      <main className="page">
        <section className="card">
          <h2>{t("fa.title")}</h2>
          <p className="muted">{t("fa.intro")}</p>
        </section>
        {al.active.length === 0
          ? <section className="card"><p>{t("fa.empty")}</p></section>
          : <div className="alist">{al.active.map((a) => <AlertCard key={a.id} a={a} canWrite={al.canWrite} />)}</div>}
        {al.recent.length > 0 && (
          <section className="card">
            <h2>{t("fa.recent")}</h2>
            <div className="alist">{al.recent.map((a) => <AlertCard key={a.id} a={a} canWrite={false} compact />)}</div>
          </section>
        )}
      </main>
    </Shell>
  );
}
