import Link from "next/link";
import { notFound } from "next/navigation";
import OwnerShell from "@/components/OwnerShell";
import { COMPANY_TYPES, MODULES, ROLES, STATUSES, countryName, getBilling, getCompany, isForeign, listPlans, renewDays, renewTone, searchAirlines } from "@/lib/admin";
import { getT } from "@/lib/lang";
import { labelOf } from "@/lib/i18n";
import { addAirline, addMember, setTypes, removeAirline, renewCompany, setBilling, setModule, setPlan, setStatus } from "../actions";
import "../admin.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE: Record<string, string> = { trial: "info", active: "ok", suspended: "late" };

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; q?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [{ t, lang }, r, plans, bill] = await Promise.all([getT(), getCompany(id), listPlans(), getBilling(id)]);
  if (r.status !== "ok") notFound();
  const c = r.data;
  const isHandler = c.business_types.some((b) => ["ground_handler", "cargo_terminal", "forwarder", "fbo"].includes(b));
  const isAirline = c.business_types.some((b) => ["passenger_airline", "cargo_airline"].includes(b));
  const audience = isAirline && !isHandler ? "airline" : "handler";
  const b = bill.status === "ok" ? bill.data : {};
  const days = renewDays(c.renews_on);
  const rl = days === null ? "—" : days < 0 ? t("own.b.late", { n: -days }) : days === 0 ? t("own.b.today") : t("own.b.in", { n: days });
  const q = (sp.q ?? "").trim();
  const hits = isHandler && q.length >= 2 ? await searchAirlines(q) : null;
  const have = new Set(c.airlines.map((a) => a.airline_id));
  const planLabel = (p: { name_ar: string; name_en: string }) => (lang === "ar" ? p.name_ar : p.name_en);

  return (
    <OwnerShell>
      <main className="page admin">
        <section className="fhero" aria-label={c.name}>
          <h1>{c.name}</h1>
          <div className="tags">
            <em className="tag info ltr">{c.code}</em>
            <em className="tag muted">{countryName(c.country, lang)}</em>
            {c.business_types.map((b) => <em key={b} className="tag info">{labelOf(lang, "own.type", b)}</em>)}
            {c.status && <em className={`tag ${TONE[c.status] ?? "muted"}`}>{t(`own.status.${c.status}` as never)}</em>}
          </div>
          <div><Link className="btn sm" href="/admin">{t("own.back")}</Link></div>
        </section>
        {sp.err && <p role="alert" className="err">{t("own.err")}</p>}

        <section className="card">
          <h2>{t("own.types.title")}</h2>
          <p className="muted"><small>{t("own.types.note")}</small></p>
          <form action={setTypes} className="adm-inline">
            <input type="hidden" name="id" value={c.id} />
            {COMPANY_TYPES.map((x) => <label key={x}><span><input type="checkbox" name="types" value={x} defaultChecked={c.business_types.includes(x)} /> {labelOf(lang, "own.type", x)}</span></label>)}
            <button className="btn">{t("own.types.save")}</button>
          </form>
        </section>

        <section className="card">
          <h2>{t("own.d.plan")}</h2>
          <form action={setPlan} className="adm-inline">
            <input type="hidden" name="id" value={c.id} />
            <label>{t("own.f.plan")}
              <select name="plan" defaultValue={c.plan_code ?? ""}>
                {plans.filter((p) => p.audience === audience).map((p) => <option key={p.code} value={p.code}>{planLabel(p)}</option>)}
              </select>
            </label>
            <button className="btn">{t("own.d.planSave")}</button>
          </form>
          <p className="muted"><small>{t("own.d.planWarn")}</small></p>
          <form action={setStatus} className="adm-inline">
            <input type="hidden" name="id" value={c.id} />
            <label>{t("own.d.status")}
              <select name="status" defaultValue={c.status ?? "trial"}>{STATUSES.map((s) => <option key={s} value={s}>{t(`own.status.${s}` as never)}</option>)}</select>
            </label>
            <label>{t("own.d.renews")}<input type="date" name="renews_on" defaultValue={c.renews_on ?? ""} className="ltr" /></label>
            <button className="btn">{t("own.d.save")}</button>
          </form>
        </section>

        <section className="card">
          <h2>{t("own.b.title")}</h2>
          <p><em className={`tag ${renewTone(days)}`}>{rl}</em> {c.renews_on && <small className="muted ltr">{c.renews_on}</small>}</p>
          {!b.billing_cycle && <p className="muted">{t("own.b.none")}</p>}
          <form action={setBilling} className="adm-inline">
            <input type="hidden" name="id" value={c.id} />
            <label>{t("own.b.cycle")}<select name="cycle" defaultValue={b.billing_cycle ?? "monthly"}><option value="monthly">{t("own.b.cycle.monthly")}</option><option value="yearly">{t("own.b.cycle.yearly")}</option></select></label>
            <label>{t("own.b.started")}<input type="date" name="started_on" required defaultValue={b.started_on ?? ""} className="ltr" /></label>
            <label>{t("own.b.amount")}<input name="amount_note" maxLength={500} defaultValue={b.amount_note ?? ""} /></label>
            <button className="btn">{t("own.b.save")}</button>
          </form>
          <p className="muted"><small>{t("own.b.amountHint")}</small></p>
          {b.billing_cycle && (
            <form action={renewCompany} className="adm-inline">
              <input type="hidden" name="id" value={c.id} />
              <button className="btn gold">{t("own.b.renew")}</button>
              <small className="muted">{t("own.b.renewHint")}</small>
            </form>
          )}
        </section>

        <section className="card">
          <h2>{t("own.d.modules")}</h2>
          <p className="muted">{t("own.d.modulesHint")}</p>
          <ul className="list">
            {MODULES.map((m) => {
              const on = c.modules[m] === true;
              return (
                <li key={m}>
                  <span className="grow">{t(`own.mod.${m}` as never)}</span>
                  <em className={`tag ${on ? "ok" : "muted"}`}>{on ? t("own.d.on") : t("own.d.off")}</em>
                  <form action={setModule}>
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="module" value={m} /><input type="hidden" name="enabled" value={on ? "false" : "true"} />
                    <button className={`btn sm ${on ? "danger" : ""}`}>{on ? t("own.d.turnOff") : t("own.d.turnOn")}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        {isHandler && (
          <section className="card">
            <h2>{t("own.d.clients")}</h2>
            <p className="muted">{t("own.d.clientsHint")}</p>
            {c.airlines.length === 0 && <p className="muted">{t("own.d.noClients")}</p>}
            <ul className="list">
              {c.airlines.map((a) => (
                <li key={a.airline_id}>
                  <span className="grow"><b>{a.name}</b> <small className="muted ltr">{[a.iata, a.icao].filter(Boolean).join(" / ")}</small></span>
                  {a.country && <em className="tag muted">{a.country}</em>}
                  {isForeign(c.country, a.country) && <em className="tag warn">{t("own.d.foreign")}</em>}
                  <form action={removeAirline}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="airline" value={a.airline_id} /><button className="btn sm danger">{t("own.d.remove")}</button></form>
                </li>
              ))}
            </ul>
            <form method="get" className="adm-inline">
              <label>{t("own.d.search")}<input type="search" name="q" defaultValue={q} minLength={2} /></label>
              <button className="btn">{t("own.d.searchBtn")}</button>
            </form>
            {hits?.status === "ok" && (
              <ul className="list">
                {hits.data.length === 0 && <li className="muted">{t("own.d.noHits")}</li>}
                {hits.data.map((a) => (
                  <li key={a.id}>
                    <span className="grow"><b>{a.name}</b> <small className="muted ltr">{[a.iata, a.icao].filter(Boolean).join(" / ")}</small></span>
                    {a.country && <em className="tag muted">{a.country}</em>}
                    {isForeign(c.country, a.country) && <em className="tag warn">{t("own.d.foreign")}</em>}
                    {have.has(a.id) ? <em className="tag ok">{t("own.d.on")}</em> : (
                      <form action={addAirline}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="airline" value={a.id} /><button className="btn sm">{t("own.d.add")}</button></form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="card">
          <h2>{t("own.d.members")}</h2>
          {c.members.length === 0 && <p className="muted">{t("own.d.noMembers")}</p>}
          <ul className="list">
            {c.members.map((m) => <li key={m.membership_id}><span className="grow ltr">{m.email ?? "—"}</span><em className="tag info">{labelOf(lang, "data.role", m.role)}</em></li>)}
          </ul>
          <form action={addMember} className="adm-inline">
            <input type="hidden" name="id" value={c.id} />
            <label>{t("own.d.memberEmail")}<input type="email" name="email" required className="ltr" /></label>
            <label>{t("own.d.memberRole")}<select name="role" defaultValue="admin">{ROLES.map((x) => <option key={x} value={x}>{labelOf(lang, "data.role", x)}</option>)}</select></label>
            <button className="btn">{t("own.d.addMember")}</button>
          </form>
          <p className="muted"><small>{t("own.d.memberHint")}</small></p>
        </section>
      </main>
    </OwnerShell>
  );
}
