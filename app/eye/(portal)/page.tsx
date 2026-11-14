import Link from "next/link";
import { eyeT } from "@/lib/eye/i18n-server";
import { eyeFlights, eyeStations, myWorkspaces, pickWorkspace } from "@/lib/eye/api";
import type { EyeFlight } from "@/lib/eye/types";
import FlightRow from "@/components/eye/FlightRow";

export const dynamic = "force-dynamic";

const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = (k: string, lang: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function EyeFlightsPage({ searchParams }: { searchParams: Promise<{ ws?: string; st?: string }> }) {
  const sp = await searchParams;
  const { t, lang } = await eyeT();
  const list = await myWorkspaces();
  const ws = list.ok ? pickWorkspace(list.data, sp.ws) : null;
  if (!ws) return null; // the layout already shows the "not linked" notice
  const [fl, stRes] = await Promise.all([eyeFlights(ws.workspace_id), eyeStations(ws.workspace_id)]);
  const stations = stRes.ok ? stRes.data : [];
  const nameOf = new Map(stations.map((s) => [s.station_id, s.name]));
  const station = stations.some((s) => s.station_id === sp.st) ? sp.st : undefined;
  const all: EyeFlight[] = fl.ok ? fl.data : [];
  const rows = station ? all.filter((f) => f.station_id === station) : all;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((f) => dayKey(f.scheduled_at) >= today).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const earlier = rows.filter((f) => dayKey(f.scheduled_at) < today).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  const days = [...new Set(upcoming.map((f) => dayKey(f.scheduled_at)))];
  const q = (extra: Record<string, string | undefined>) => { const p = new URLSearchParams(); if (list.ok && list.data.length > 1) p.set("ws", ws.workspace_id); Object.entries(extra).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return s ? `/eye?${s}` : "/eye"; };
  const warn = stations.filter((s) => s.coverage !== "covered");
  const row = (f: EyeFlight) => <FlightRow key={`${f.turn_id}-${f.direction}`} f={f} ws={ws.workspace_id} t={t} stationName={stations.length > 1 ? nameOf.get(f.station_id) ?? null : null} />;

  return (
    <div className="eye-page">
      <div>
        <h1>{t("flights")}</h1>
        <p className="muted eye-sub">{t("flightsSub")}</p>
      </div>

      {list.ok && list.data.length > 1 && (
        <nav className="eye-filter" aria-label={t("workspace")}>
          {list.data.map((w) => <Link key={w.workspace_id} className={`chip-link${w.workspace_id === ws.workspace_id ? " on" : ""}`} href={`/eye?ws=${w.workspace_id}`}>{w.name}</Link>)}
        </nav>
      )}
      {stations.length > 1 && (
        <nav className="eye-filter" aria-label={t("station")}>
          <Link className={`chip-link${station ? "" : " on"}`} href={q({})}>{t("allStations")}</Link>
          {stations.map((s) => <Link key={s.station_id} className={`chip-link${station === s.station_id ? " on" : ""}`} href={q({ st: s.station_id })}>{s.name}</Link>)}
        </nav>
      )}
      {warn.map((s) => <p key={s.station_id} className="eye-note" role="status"><b>{s.name}</b> — {t(s.coverage === "stopped" ? "cov_stopped" : "cov_pending_link")}</p>)}

      {!fl.ok ? <p className="eye-note err" role="alert">{t("listErr")}</p> : (
        <>
          {upcoming.length === 0 ? <p className="muted">{t("noFlights")}</p> : days.map((d) => (
            <section key={d} className="eye-day">
              <h2>{dayLabel(d, lang)}</h2>
              <ul className="eye-list">{upcoming.filter((f) => dayKey(f.scheduled_at) === d).map(row)}</ul>
            </section>
          ))}
          <details className="eye-earlier">
            <summary>{t("earlier")} ({earlier.length})</summary>
            {earlier.length === 0 ? <p className="muted">{t("noEarlier")}</p> : <ul className="eye-list">{earlier.map(row)}</ul>}
          </details>
        </>
      )}
    </div>
  );
}
