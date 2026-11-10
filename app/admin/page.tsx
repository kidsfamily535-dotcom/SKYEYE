import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { getCommandData } from "@/lib/data";
import { getAdminData, type AdminCompany, type AdminMember } from "@/lib/admin";
import { getT } from "@/lib/lang";
import { labelOf, type Key } from "@/lib/i18n";
import { setEmployeeActive } from "./actions";
import "./admin.css";

const utc = (iso: string | null) => (iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : "—");

function status(c: AdminCompany): { tone: "ok" | "late" | "info"; key: Key } {
  if (c.mailboxes_failing + c.gmail_failing > 0) return { tone: "late", key: "admin.h.failing" };
  if (!c.last_email_at) return { tone: "info", key: "admin.h.idle" };
  return { tone: "ok", key: "admin.h.ok" };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; err?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "people" ? "people" : "health";
  const [{ t, lang }, d, a] = await Promise.all([getT(), getCommandData(), getAdminData()]);
  if (a.status === "denied") notFound();

  return (
    <Shell data={d}>
      <main className="page admin">
        <section className="fhero" aria-label={t("admin.title")}><h1>{t("admin.title")}</h1><p>{t("admin.sub")}</p></section>
        {a.status === "error" && <p role="alert" className="err">{t("fl.err.generic")}</p>}
        {a.status === "ok" && (<>
          <nav className="tabs" aria-label={t("admin.title")}>
            <Link href="/admin" className={tab === "health" ? "on" : ""} aria-current={tab === "health" ? "page" : undefined}>{t("admin.tab.health")}</Link>
            <Link href="/admin?tab=people" className={tab === "people" ? "on" : ""} aria-current={tab === "people" ? "page" : undefined}>{t("admin.tab.people")}</Link>
          </nav>

          {tab === "health" && (<>
            <div className="adm-grid">
              {a.companies.map((c) => {
                const s = status(c);
                const channels = Object.entries(c.emails_by_channel);
                return (
                  <article key={c.id} className="card">
                    <header className="adm-head"><h2>{c.name}</h2><em className={`tag ${s.tone}`}>{t(s.key)}</em></header>
                    <dl className="facts">
                      <div><dt>{t("admin.f.emails")}</dt><dd>{c.emails_total}</dd></div>
                      <div><dt>{t("admin.f.emails24")}</dt><dd>{c.emails_24h}</dd></div>
                      <div><dt>{t("admin.f.lastEmail")}</dt><dd className="ltr">{utc(c.last_email_at)}</dd></div>
                      <div><dt>{t("admin.f.channels")}</dt><dd>{channels.length ? channels.map(([k, n]) => `${labelOf(lang, "admin.ch", k)}: ${n}`).join(" / ") : "—"}</dd></div>
                      <div><dt>{t("admin.f.mailboxes")}</dt><dd>{c.direct_mailboxes}</dd></div>
                      <div><dt>{t("admin.f.alerts")}</dt><dd>{c.open_alerts}</dd></div>
                      <div><dt>{t("admin.f.employees")}</dt><dd>{c.active_employees}</dd></div>
                      <div><dt>{t("admin.f.activity")}</dt><dd className="ltr">{utc(c.last_activity_at)}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <section className="card">
              <h2>{t("admin.recent")}</h2>
              {a.activity.length === 0 && <p className="muted">{t("admin.recent.empty")}</p>}
              <ul className="list">
                {a.activity.map((x) => (
                  <li key={x.id}><span className="grow"><b className="ltr">{x.action}</b><small className="muted"> {x.company_name ?? ""}</small></span><small className="muted ltr">{utc(x.created_at)}</small></li>
                ))}
              </ul>
            </section>
          </>)}

          {tab === "people" && (<>
            {sp.err && <p role="alert" className="err">{t("admin.err")}</p>}
            {a.companies.map((c) => {
              const people = a.members.filter((m) => m.company_id === c.id);
              return (
                <section key={c.id} className="card">
                  <h2>{c.name}</h2>
                  {people.length === 0 && <p className="muted">{t("admin.p.noMembers")}</p>}
                  <ul className="list">
                    {people.map((m) => <PersonRow key={m.membership_id} m={m} mine={!!a.myEmail && m.email === a.myEmail} t={t} lang={lang} />)}
                  </ul>
                </section>
              );
            })}
          </>)}
        </>)}
      </main>
    </Shell>
  );
}

function PersonRow({ m, mine, t, lang }: { m: AdminMember; mine: boolean; t: (k: Key) => string; lang: "ar" | "en" }) {
  const hasEmp = !!m.employee_id;
  return (
    <li>
      <span className="grow adm-who"><b>{m.full_name ?? m.email ?? "—"}</b><small className="muted ltr">{m.email ?? ""}{m.role_title ? ` · ${m.role_title}` : ""}</small></span>
      <em className="tag info">{labelOf(lang, "data.role", m.role)}</em>
      {hasEmp ? (<>
        <em className={`tag ${m.active ? "ok" : "warn"}`}>{m.active ? t("admin.p.active") : t("admin.p.inactive")}</em>
        {mine ? <small className="muted">{t("admin.p.you")}</small> : (
          <form action={setEmployeeActive}>
            <input type="hidden" name="employee_id" value={m.employee_id!} />
            <input type="hidden" name="active" value={m.active ? "false" : "true"} />
            <button className={`btn sm ${m.active ? "danger" : ""}`}>{m.active ? t("admin.p.deactivate") : t("admin.p.activate")}</button>
          </form>
        )}
      </>) : <small className="muted">{t("admin.p.noEmployee")}</small>}
    </li>
  );
}
