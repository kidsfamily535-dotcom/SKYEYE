import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { getCommandData } from "@/lib/data";
import { COMPANY_TYPES, isPlatformAdmin, listPlans } from "@/lib/admin";
import { getT } from "@/lib/lang";
import { labelOf } from "@/lib/i18n";
import { createCompany } from "../actions";
import "../admin.css";

export default async function NewCompanyPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const [{ t, lang }, d, owner, plans] = await Promise.all([getT(), getCommandData(), isPlatformAdmin(), listPlans()]);
  if (!owner) notFound();
  const group = (aud: "handler" | "airline") => plans.filter((p) => p.audience === aud);
  return (
    <Shell data={d} bypass>
      <main className="page admin">
        <section className="card">
          <div className="adm-head"><h2>{t("own.new.title")}</h2><Link className="btn sm" href="/admin">{t("own.back")}</Link></div>
          <p className="muted">{t("own.new.note")}</p>
          {sp.err && <p role="alert" className="err">{t("own.err")}</p>}
          <form action={createCompany} className="adm-form">
            <label>{t("own.new.name")}<input name="name" required minLength={2} maxLength={120} /></label>
            <label>{t("own.new.code")}<input name="code" required pattern="[A-Za-z0-9]{2,12}" maxLength={12} className="ltr" /><small>{t("own.new.codeHint")}</small></label>
            <label>{t("own.new.country")}<input name="country" required pattern="[A-Za-z]{2}" maxLength={2} defaultValue="EG" className="ltr" /><small>{t("own.new.countryHint")}</small></label>
            <label>{t("own.new.type")}
              <select name="type" required defaultValue="ground_handler">
                {COMPANY_TYPES.map((x) => <option key={x} value={x}>{labelOf(lang, "own.type", x)}</option>)}
              </select>
            </label>
            <label>{t("own.new.plan")}
              <select name="plan" required defaultValue="trial">
                {(["handler", "airline"] as const).map((a) => (
                  <optgroup key={a} label={t(`own.plan.${a}` as never)}>
                    {group(a).map((p) => <option key={p.code} value={p.code}>{lang === "ar" ? p.name_ar : p.name_en}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div><button className="btn gold">{t("own.new.submit")}</button></div>
          </form>
        </section>
      </main>
    </Shell>
  );
}
