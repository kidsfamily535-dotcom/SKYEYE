import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { getCommandData } from "@/lib/data";
import { countryName, listCompanies, listPlans } from "@/lib/admin";
import { getT } from "@/lib/lang";
import { labelOf } from "@/lib/i18n";
import "./admin.css";

const utc = (iso: string | null) => (iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : "—");
const TONE: Record<string, string> = { trial: "info", active: "ok", suspended: "late" };

export default async function AdminPage() {
  const [{ t, lang }, d, r] = await Promise.all([getT(), getCommandData(), listCompanies()]);
  if (r.status === "denied") notFound();
  const plans = await listPlans();
  const planName = (c: string | null) => { const p = plans.find((x) => x.code === c); return p ? (lang === "ar" ? p.name_ar : p.name_en) : "—"; };
  return (
    <Shell data={d}>
      <main className="page admin">
        <section className="fhero" aria-label={t("own.title")}>
          <h1>{t("own.title")}</h1><p>{t("own.sub")}</p>
          <div><Link className="btn gold" href="/admin/new">{t("own.add")}</Link></div>
        </section>
        {r.status === "error" && <p role="alert" className="err">{t("own.err")}</p>}
        {r.status === "ok" && r.data.length === 0 && <p className="muted">{t("own.empty")}</p>}
        {r.status === "ok" && (
          <div className="adm-grid">
            {r.data.map((c) => (
              <Link key={c.id} href={`/admin/${c.id}`} className="adm-link">
                <article className="card">
                  <header className="adm-head"><h2>{c.name}</h2><em className={`tag ${TONE[c.status ?? ""] ?? "muted"}`}>{c.status ? t(`own.status.${c.status}` as never) : "—"}</em></header>
                  <div className="tags">{c.business_types.map((b) => <em key={b} className="tag info">{labelOf(lang, "own.type", b)}</em>)}</div>
                  <dl className="facts">
                    <div><dt>{t("own.f.country")}</dt><dd>{countryName(c.country, lang)}</dd></div>
                    <div><dt>{t("own.f.plan")}</dt><dd>{planName(c.plan_code)}</dd></div>
                    <div><dt>{t("own.f.members")}</dt><dd>{c.members}</dd></div>
                    <div><dt>{t("own.f.airlines")}</dt><dd>{c.airlines}</dd></div>
                    <div><dt>{t("own.f.activity")}</dt><dd className="ltr">{utc(c.last_activity_at)}</dd></div>
                  </dl>
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </Shell>
  );
}
