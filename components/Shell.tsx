import Nav from "./Nav";
import UtcClock from "./UtcClock";
import Link from "next/link";
import type { CommandData } from "@/lib/data";
import { countPendingReports } from "@/lib/shifts";
import { getAlerts, needsAttention } from "@/lib/alerts";
import AlertBell from "./AlertBell";
import { getT } from "@/lib/lang";
import LangSwitch from "./LangSwitch";

export default async function Shell({ data, children }: { data: CommandData; children: React.ReactNode }) {
  const [pending, alerts] = await Promise.all([
    countPendingReports().catch(() => 0),
    getAlerts().catch(() => ({ active: [], recent: [], canWrite: false })),
  ]);
  const bell = alerts.active.filter(needsAttention);
  const { t } = await getT();
  return (
    <div className="app">
      <aside className="side" aria-label={t("nav.aria")}>
        <div className="brand"><b className="logo">{data.company.name.slice(0, 5)}</b><div><strong>SKYEYE</strong><small>{data.company.name} · {data.company.kind}</small></div></div>
        <Nav />
      </aside>
      <div className="main">
        <header className="top">
          <span className="grow" />
          <AlertBell total={bell.length} pendingReports={pending} alerts={bell.map((a) => ({ id: a.id, level: a.level, state: a.state, ruleCode: a.ruleCode, ruleNameAr: a.ruleNameAr, reasonAr: a.reasonAr, flightNumber: a.flightNumber, flightId: a.flightId, dueAt: a.dueAt }))} />
          <LangSwitch />
          <UtcClock />
          {data.shadowMode && <span className="chip shadow">{t("shell.shadow")}</span>}
          <div className="user"><span className="av">{data.user.name.slice(0, 1)}</span><div><strong>{data.user.name}</strong><small>{data.user.role}</small></div><form action="/auth/signout" method="post"><button className="btn ghost">{t("shell.signout")}</button></form></div>
        </header>
        {children}
      </div>
    </div>
  );
}
