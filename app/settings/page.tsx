import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { getCommandData } from "@/lib/data";
import { countryName, listPlans } from "@/lib/admin";
import { getDraftPolicies, getInvites, getProfile, getTeam, TEAM_ROLES, type PolicyTable } from "@/lib/settings";
import { getT } from "@/lib/lang";
import { labelOf } from "@/lib/i18n";
import { approvePolicy, cancelInvite, inviteMember, removeMember, setRole } from "./actions";
import "../admin/admin.css";

const TONE: Record<string, string> = { trial: "info", active: "ok", suspended: "late" };
const GROUP: Record<PolicyTable, "set.pol.alert" | "set.pol.request" | "set.pol.escalation"> = { flight_alert_rules: "set.pol.alert", request_policies: "set.pol.request", escalation_policies: "set.pol.escalation" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ err?: string; inv?: string }> }) {
  const sp = await searchParams;
  const [{ t, lang }, d] = await Promise.all([getT(), getCommandData()]);
  const team = await getTeam();
  const suspended = d.access.status === "suspended";
  if (team.status === "denied" && !suspended) notFound();
  const ready = team.status === "ok" && !d.noMembership;
  const [profile, pol, plans, invites] = ready ? await Promise.all([getProfile(d.company.id), getDraftPolicies(d.company.id), listPlans(), getInvites()]) : [null, null, [], []];
  const plan = plans.find((p) => p.code === profile?.plan);
  const planName = plan ? (lang === "ar" ? plan.name_ar : plan.name_en) : "—";
  const unit = (m: number | null, h: number | null) => (m !== null ? t("set.min", { n: m }) : h !== null ? t("set.hours", { n: h }) : "—");

  return (
    <Shell data={d}>
      <main className="page admin">
        <section className="fhero" aria-label={t("set.title")}><h1>{t("set.title")}</h1><p>{t("set.sub")}</p></section>
        {(sp.err || team.status === "error") && <p role="alert" className="err">{t("set.err")}</p>}
        {sp.inv && <p role="status" className="muted">{t("set.inv.ok")}</p>}

        {ready && profile && (
          <section className="card">
            <h2>{t("set.profile")}</h2>
            <div className="tags">
              {profile.code && <em className="tag info ltr">{profile.code}</em>}
              {profile.types.map((b) => <em key={b} className="tag info">{labelOf(lang, "own.type", b)}</em>)}
              {profile.status && <em className={`tag ${TONE[profile.status] ?? "muted"}`}>{t(`own.status.${profile.status}` as never)}</em>}
            </div>
            {profile.types.length === 0 && <p className="muted">{t("set.noType")}</p>}
            <dl className="facts">
              <div><dt>{t("own.f.country")}</dt><dd>{countryName(profile.country, lang)}</dd></div>
              <div><dt>{t("own.f.plan")}</dt><dd>{planName}</dd></div>
              <div><dt>{t("own.f.renews")}</dt><dd className="ltr">{profile.renews_on ?? "—"}</dd></div>
            </dl>
          </section>
        )}

        {ready && (
          <section className="card">
            <h2>{t("set.team")}</h2>
            <p className="muted"><small>{t("set.team.note")}</small></p>
            <ul className="list">
              {team.status === "ok" && team.data.map((m) => (
                <li key={m.membership_id}>
                  <span className="grow"><b>{m.full_name ?? m.email ?? "—"}</b>{m.full_name && <small className="muted ltr"> {m.email}</small>}{m.role_title && <small className="muted"> · {m.role_title}</small>}</span>
                  {m.me && <em className="tag ok">{t("set.team.you")}</em>}
                  {m.me || m.role === "owner" ? (
                    <em className="tag info">{labelOf(lang, "set.role", m.role)}</em>
                  ) : (
                    <>
                      <form action={setRole} className="adm-inline">
                        <input type="hidden" name="id" value={m.membership_id} />
                        <select name="role" defaultValue={m.role} aria-label={t("set.team")}>{TEAM_ROLES.map((r) => <option key={r} value={r}>{labelOf(lang, "set.role", r)}</option>)}</select>
                        <button className="btn sm">{t("set.role.save")}</button>
                      </form>
                      <details>
                        <summary className="btn sm danger">{t("set.remove")}</summary>
                        <form action={removeMember}>
                          <p className="muted"><small>{t("set.remove.note")}</small></p>
                          <input type="hidden" name="id" value={m.membership_id} />
                          <button className="btn sm danger solid">{t("set.remove.confirm")}</button>
                        </form>
                      </details>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {ready && (
          <section className="card">
            <h2>{t("set.inv.title")}</h2>
            <p className="muted"><small>{t("set.inv.note")}</small></p>
            <form action={inviteMember} className="adm-inline">
              <label>{t("set.inv.name")}<input name="name" required maxLength={120} /></label>
              <label>{t("set.inv.email")}<input name="email" type="email" required maxLength={254} className="ltr" /></label>
              <label>{t("set.inv.role")}<select name="role" defaultValue="operator">{TEAM_ROLES.map((r) => <option key={r} value={r}>{labelOf(lang, "set.role", r)}</option>)}</select></label>
              <button className="btn sm gold">{t("set.inv.send")}</button>
            </form>
            <h3>{t("set.inv.pending")}</h3>
            {invites.length === 0 ? <p className="muted">{t("set.inv.none")}</p> : (
              <ul className="list">
                {invites.map((i) => (
                  <li key={i.id}>
                    <span className="grow"><b>{i.full_name}</b> <small className="muted ltr">{i.email}</small></span>
                    <em className="tag info">{labelOf(lang, "set.role", i.role)}</em>
                    <em className="tag muted ltr">{t("set.inv.expires", { date: i.expires_at.slice(0, 10) })}</em>
                    <form action={cancelInvite}><input type="hidden" name="id" value={i.id} /><button className="btn sm danger">{t("set.inv.cancel")}</button></form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {ready && pol && (
          <section className="card">
            <h2>{t("set.pol.title")}</h2>
            <p className="muted"><small>{t("set.pol.note")}</small></p>
            {pol.rows.length === 0 ? <p className="muted">{t("set.pol.none")}</p> : (
              <ul className="list">
                {pol.rows.map((r) => (
                  <li key={`${r.table}-${r.id}`}>
                    <span className="grow"><b><bdi>{r.title}</bdi></b> <small className="muted">{t(GROUP[r.table])}{r.extra ? ` · ${r.extra}` : ""}</small></span>
                    <em className="tag muted ltr">{unit(r.minutes, r.hours)}</em>
                    <form action={approvePolicy}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="table" value={r.table} /><button className="btn sm gold">{t("set.pol.approve")}</button></form>
                  </li>
                ))}
              </ul>
            )}
            <div className="tags">
              {(Object.keys(pol.approved) as PolicyTable[]).map((k) => <em key={k} className="tag ok">{t(GROUP[k])}: {t("set.pol.approved", { n: pol.approved[k] })}</em>)}
            </div>
          </section>
        )}
      </main>
    </Shell>
  );
}
