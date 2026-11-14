import Link from "next/link";
import { notFound } from "next/navigation";
import { eyeT } from "@/lib/eye/i18n-server";
import type { EyeKey } from "@/lib/eye/i18n";
import { eyeAudit, eyeLinkable, eyeMembers, eyeStations, myWorkspaces, pickWorkspace } from "@/lib/eye/api";
import { cancelInvite, inviteUser, linkStation, setMemberRole, setMemberStatus, setStationLink } from "./actions";

export const dynamic = "force-dynamic";

const utc = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

export default async function EyeAdminPage({ searchParams }: { searchParams: Promise<{ ws?: string; ok?: string; err?: string; before?: string }> }) {
  const sp = await searchParams;
  const { t } = await eyeT();
  const list = await myWorkspaces();
  const ws = list.ok ? pickWorkspace(list.data.filter((w) => w.role === "airline_admin"), sp.ws) : null;
  if (!ws) notFound(); // only an airline administrator has this screen; the database refuses everyone else anyway
  const id = ws.workspace_id;
  const before = /^\d{1,15}$/.test(sp.before ?? "") ? Number(sp.before) : undefined;
  const [mem, st, lk, au] = await Promise.all([eyeMembers(id), eyeStations(id), eyeLinkable(id), eyeAudit(id, before)]);
  const members = mem.ok ? mem.data.members : [];
  const invites = mem.ok ? mem.data.invites : [];
  const stations = st.ok ? st.data : [];
  const linkable = lk.ok ? lk.data : [];
  const audit = au.ok ? au.data : [];
  const companyOf = new Map(linkable.filter((l) => l.linked_station_id).map((l) => [l.linked_station_id as string, l.company_name]));
  const available = linkable.filter((l) => !l.linked_station_id);
  const adminWs = list.ok ? list.data.filter((w) => w.role === "airline_admin") : [];
  const roleLabel = (r: string) => t(`role_${r}` as EyeKey);
  const detail = (a: (typeof audit)[number]) => {
    if (a.action !== "member_role_changed") return null;
    const d = a.details as { from?: string; to?: string };
    return d.from && d.to ? `${roleLabel(d.from)} ← ${roleLabel(d.to)}` : null;
  };
  const label = (a: string) => { const k = `a_${a}` as EyeKey; return (["a_invite","a_invite_cancelled","a_member_stopped","a_member_activated","a_member_role_changed","a_station_linked","a_station_link_stopped","a_station_link_resumed","a_add_station","a_create_workspace","a_import_turns","a_record_end","a_record_start","a_set_in_block","a_state_reason"] as string[]).includes(k) ? t(k) : a; };
  const errKey = sp.err ? (`err_${sp.err}` as EyeKey) : null;
  const errText = errKey && ["err_notAllowed","err_self","err_lastAdmin","err_noContract","err_airportTaken","err_recorder","err_exists","err_invalid","err_generic"].includes(errKey) ? t(errKey) : sp.err ? t("err_generic") : null;
  const Hidden = () => <input type="hidden" name="ws" value={id} />;

  return (
    <div className="eye-page">
      <div>
        <h1>{t("admTitle")}</h1>
        <p className="muted eye-sub">{t("admSub")}</p>
      </div>
      {adminWs.length > 1 && (
        <nav className="eye-filter" aria-label={t("workspace")}>
          {adminWs.map((w) => <Link key={w.workspace_id} className={`chip-link${w.workspace_id === id ? " on" : ""}`} href={`/eye/admin?ws=${w.workspace_id}`}>{w.name}</Link>)}
        </nav>
      )}
      {errText && <p className="eye-note err" role="alert">{errText}</p>}
      {!errText && sp.ok && <p className="eye-note ok" role="status">{t("okSaved")}</p>}

      <section className="eye-card" id="users" aria-labelledby="h-users">
        <h2 id="h-users">{t("usersTitle")}</h2>
        {!mem.ok && <p className="eye-note err" role="alert">{t("err_generic")}</p>}
        <form action={inviteUser} className="eye-form">
          <Hidden />
          <h3>{t("inviteTitle")}</h3>
          <div className="eye-formgrid">
            <label>{t("fName")}<input name="name" required maxLength={120} autoComplete="off" /></label>
            <label>{t("fEmail")}<input name="email" type="email" required maxLength={254} dir="ltr" autoComplete="off" /></label>
            <label>{t("fRole")}
              <select name="role" defaultValue="airline_viewer"><option value="airline_viewer">{roleLabel("airline_viewer")}</option><option value="airline_admin">{roleLabel("airline_admin")}</option></select>
            </label>
            <button className="btn gold sm" type="submit">{t("inviteBtn")}</button>
          </div>
          <small className="muted">{t("inviteHint")}</small>
        </form>

        {invites.length > 0 && <h3>{t("pendingInvites")} ({invites.length})</h3>}
        {invites.map((i) => (
          <div key={i.invite_id} className="eye-item">
            <div className="who"><b>{i.name}</b><small className="ltr">{i.email}</small><small>{t("expiresOn")} {utc(i.expires_at)}</small></div>
            <span className="eye-chip">{roleLabel(i.role)}</span>
            <form action={cancelInvite}><Hidden /><input type="hidden" name="invite" value={i.invite_id} /><button className="btn ghost sm" type="submit">{t("cancelInvite")}</button></form>
          </div>
        ))}

        <h3>{t("members")} ({members.length})</h3>
        {members.map((m) => {
          const canRole = !m.is_me && (m.role === "airline_admin" || m.role === "airline_viewer");
          return (
            <div key={m.member_id} className={`eye-item${m.status === "stopped" ? " off" : ""}`}>
              <div className="who"><b>{m.name}{m.is_me ? ` (${t("you")})` : ""}</b>{m.email && <small className="ltr">{m.email}</small>}</div>
              <span className="eye-chip">{roleLabel(m.role)}</span>
              <span className={`eye-chip ${m.status === "active" ? "ok" : "off"}`}>{t(m.status === "active" ? "stActive" : "stStopped")}</span>
              {!m.is_me && (
                <div className="eye-actions">
                  {canRole && <form action={setMemberRole}><Hidden /><input type="hidden" name="member" value={m.member_id} /><input type="hidden" name="role" value={m.role === "airline_admin" ? "airline_viewer" : "airline_admin"} /><button className="btn ghost sm" type="submit">{t(m.role === "airline_admin" ? "btnMakeViewer" : "btnMakeAdmin")}</button></form>}
                  <form action={setMemberStatus}><Hidden /><input type="hidden" name="member" value={m.member_id} /><input type="hidden" name="status" value={m.status === "active" ? "stopped" : "active"} /><button className="btn ghost sm" type="submit">{t(m.status === "active" ? "btnStop" : "btnActivate")}</button></form>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="eye-card" id="stations" aria-labelledby="h-stations">
        <h2 id="h-stations">{t("stationsTitle")}</h2>
        <p className="muted eye-sub">{t("stationsSub")}</p>
        <h3>{t("linkedStations")}</h3>
        {stations.length === 0 && <p className="muted">{t("noStations")}</p>}
        {stations.map((s) => (
          <div key={s.station_id} className={`eye-item${s.coverage === "stopped" ? " off" : ""}`}>
            <div className="who"><b>{s.name}</b><small>{s.mode === "skyeye" ? `${t("modeSkyeye")}${companyOf.get(s.station_id) ? ` · ${companyOf.get(s.station_id)}` : ""}` : t("modeDelegated")}</small></div>
            <span className={`eye-chip ${s.coverage === "covered" ? "ok" : "off"}`}>{t(s.coverage === "covered" ? "cov_covered" : s.coverage === "stopped" ? "stStopped" : "cov_pending_link")}</span>
            {s.mode === "skyeye" && (
              <form action={setStationLink}><Hidden /><input type="hidden" name="station" value={s.station_id} /><input type="hidden" name="active" value={s.coverage === "covered" ? "false" : "true"} />
                <button className="btn ghost sm" type="submit">{t(s.coverage === "covered" ? "btnStopLink" : "btnResumeLink")}</button></form>
            )}
          </div>
        ))}
        <h3>{t("availStations")}</h3>
        {available.length === 0 && <p className="muted">{t("noAvail")}</p>}
        {available.map((a) => (
          <div key={a.station_id} className="eye-item">
            <div className="who"><b>{a.station_name}{a.airport_iata ? ` · ${a.airport_iata}` : ""}</b><small>{a.company_name}</small></div>
            <form action={linkStation}><Hidden /><input type="hidden" name="company" value={a.company_id} /><input type="hidden" name="station" value={a.station_id} /><button className="btn gold sm" type="submit">{t("btnLink")}</button></form>
          </div>
        ))}
      </section>

      <section className="eye-card" id="activity" aria-labelledby="h-act">
        <h2 id="h-act">{t("activityTitle")}</h2>
        {audit.length === 0 && <p className="muted">{t("noActivity")}</p>}
        <ul className="eye-log-list eye-actlist">
          {audit.map((a) => (
            <li key={a.id}><i aria-hidden="true" /><span><b>{label(a.action)}</b>{detail(a) ? ` · ${detail(a)}` : ""}{a.actor_name ? ` · ${t("by")} ${a.actor_name}` : ""}</span><small className="ltr">{utc(a.at)}</small></li>
          ))}
        </ul>
        {audit.length >= 30 && <Link className="btn ghost sm" href={`/eye/admin?ws=${id}&before=${audit[audit.length - 1].id}#activity`}>{t("older")}</Link>}
      </section>
    </div>
  );
}
