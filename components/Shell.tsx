import Nav from "./Nav";
import UtcClock from "./UtcClock";
import Link from "next/link";
import type { CommandData } from "@/lib/data";
import { countPendingReports } from "@/lib/shifts";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { inCompanyView } from "@/lib/mode";
import { backToOwner } from "@/app/mode-actions";
import { getT } from "@/lib/lang";
import LangSwitch from "./LangSwitch";

const NAV_MODULE: Record<string, string> = { "/inbox": "emails", "/flights": "flights" };

/** module: the plan module this page needs. A suspended company sees a notice instead of the page. The platform owner only sees the company app in preview mode; otherwise he is sent to the owner console. */
export default async function Shell({ data, children, module }: { data: CommandData; children: React.ReactNode; module?: string }) {
  const [pending, owner, preview] = await Promise.all([countPendingReports().catch(() => 0), isPlatformAdmin(), inCompanyView()]);
  if (owner && !preview) redirect("/admin");
  const { t } = await getT();
  const mods = data.access.modules;
  const suspended = data.access.status === "suspended";
  const off = !suspended && !!module && mods !== null && !mods.includes(module);
  const hidden = mods === null ? [] : Object.entries(NAV_MODULE).filter(([, m]) => !mods.includes(m)).map(([h]) => h);
  return (
    <div className="app">
      <aside className="side" aria-label={t("nav.aria")}>
        <div className="brand"><b className="logo">{data.company.name.slice(0, 5)}</b><div><strong>SKYEYE</strong><small>{data.company.name} · {data.company.kind}</small></div></div>
        <Nav hidden={hidden} />
      </aside>
      <div className="main">
        <header className="top">
          <span className="grow" />
          <Link href="/handover" className="bell" aria-label={pending > 0 ? t("shell.handoverPending", { n: pending }) : t("shell.handover")} title={t("shell.handover")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 19.5a2 2 0 0 0 4 0" /></svg>
            {pending > 0 && <b className="badge">{pending}</b>}
          </Link>
          {owner && <form action={backToOwner}><button className="chip" title={t("shell.backOwner")}>{t("shell.backOwner")}</button></form>}
          <LangSwitch />
          <UtcClock />
          {data.shadowMode && <span className="chip shadow">{t("shell.shadow")}</span>}
          <div className="user"><span className="av">{data.user.name.slice(0, 1)}</span><div><strong>{data.user.name}</strong><small>{data.user.role}</small></div><form action="/auth/signout" method="post"><button className="btn ghost">{t("shell.signout")}</button></form></div>
        </header>
        {owner && <p className="viewas" role="status">{t("shell.viewingAs", { name: data.company.name })}</p>}
        {suspended || off ? (
          <main className="page"><section className="card" role="alert"><h2>{t(suspended ? "own.gate.suspended.title" : "own.gate.off.title")}</h2><p className="muted">{t(suspended ? "own.gate.suspended.text" : "own.gate.off.text")}</p></section></main>
        ) : children}
      </div>
    </div>
  );
}
