import OwnerNav from "./OwnerNav";
import UtcClock from "./UtcClock";
import LangSwitch from "./LangSwitch";
import { getCommandData } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import { viewAsCompany } from "@/app/mode-actions";

/** Frame of the platform owner's console: its own sidebar and top bar, none of the company app's navigation. */
export default async function OwnerShell({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  const [d, auth] = await Promise.all([getCommandData(), createClient().then((s) => s.auth.getUser())]);
  const email = auth.data.user?.email ?? "";
  const canPreview = !d.noMembership;
  return (
    <div className="app">
      <aside className="side" aria-label={t("nav.aria")}>
        <div className="brand"><b className="logo">SKY</b><div><strong>SKYEYE</strong><small>{t("own.shell.brand")}</small></div></div>
        <OwnerNav />
      </aside>
      <div className="main">
        <header className="top">
          <span className="grow" />
          {canPreview && (
            <form action={viewAsCompany}><button className="chip" title={t("own.viewAs.hint")}>{t("own.viewAs", { name: d.company.name })}</button></form>
          )}
          <LangSwitch />
          <UtcClock />
          <div className="user"><span className="av">{email.slice(0, 1).toUpperCase()}</span><div><strong className="ltr">{email}</strong><small>{t("own.shell.role")}</small></div><form action="/auth/signout" method="post"><button className="btn ghost">{t("shell.signout")}</button></form></div>
        </header>
        {children}
      </div>
    </div>
  );
}
