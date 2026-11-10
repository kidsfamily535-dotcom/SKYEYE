import Nav from "./Nav";
import UtcClock from "./UtcClock";
import Link from "next/link";
import type { CommandData } from "@/lib/data";
import { countPendingReports } from "@/lib/shifts";
import { getT } from "@/lib/lang";
import LangSwitch from "./LangSwitch";

export default async function Shell({ data, children }: { data: CommandData; children: React.ReactNode }) {
  const pending = await countPendingReports().catch(() => 0);
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
          <Link href="/handover" className="bell" aria-label={pending > 0 ? t("shell.handoverPending", { n: pending }) : t("shell.handover")} title={t("shell.handover")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 19.5a2 2 0 0 0 4 0" /></svg>
            {pending > 0 && <b className="badge">{pending}</b>}
          </Link>
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
