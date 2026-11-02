import { createClient } from "@/lib/supabase/server";
import type { Decision, RadarCounts } from "@/lib/data";
import { getT } from "@/lib/lang";

export type Cockpit = {
  todayFlights: number | null; onGround: number | null; delayed: number | null;
  radar: RadarCounts;
  flightDecisions: Decision[];
  memory: { activeFlights: number | null; pendingEmails: number | null; openTasks: number | null; awaiting: number | null; lastShift: { name: string; acknowledged: boolean; at: string } | null };
};

const LATE_MS = 15 * 60 * 1000;

/** Live picture computed only from recorded times (ATA/ATD) against the clock. Nothing is estimated beyond "past its scheduled time with nothing recorded". */
export async function getCockpit(): Promise<Cockpit> {
  const sb = await createClient();
  const { t: tr } = await getT();
  const now = Date.now(); const today = new Date(now).toISOString().slice(0, 10);
  const [fl, tasks, awaiting, emails, shift] = await Promise.all([
    sb.from("v_flight_file").select("rotation_id, flight_in, flight_out, date_in, date_out, sta, std, eta, ata, atd, status").limit(500),
    sb.from("request_files").select("id", { count: "exact", head: true }).is("closed_at", null),
    sb.from("turnaround_checkins").select("id", { count: "exact", head: true }).in("status", ["asked", "late"]),
    sb.from("email_triage").select("id", { count: "exact", head: true }).eq("status", "new"),
    sb.from("shift_reports").select("shift_name, status, acknowledged_at, generated_at").order("generated_at", { ascending: false }).limit(1),
  ]);
  type R = { rotation_id: string; flight_in: string | null; flight_out: string | null; date_in: string | null; date_out: string | null; sta: string | null; std: string | null; eta: string | null; ata: string | null; atd: string | null; status: string };
  const rows = ((fl.data ?? []) as R[]).filter((r) => r.status !== "cancelled");
  const t = (x: string | null) => (x ? +new Date(x) : null);

  const done = (r: R) => !!r.atd;
  const live = rows.filter((r) => !done(r));
  const onGround = rows.filter((r) => r.ata && !r.atd);
  const inbound = rows.filter((r) => !r.ata && (t(r.eta) ?? t(r.sta) ?? 0) >= now);
  const late = live.filter((r) => (!r.ata && (t(r.sta) ?? Infinity) < now - LATE_MS) || (!!r.ata && (t(r.std) ?? Infinity) < now - LATE_MS));
  const todayFlights = rows.filter((r) => r.date_in === today || r.date_out === today).length;

  const flightDecisions: Decision[] = late.slice(0, 3).map((r) => {
    const label = r.flight_in ?? r.flight_out ?? tr("cockpit.flight");
    return { id: `fl-${r.rotation_id}`, tone: "late", href: `/flights?id=${r.rotation_id}`, action: tr("cockpit.open"),
      text: `${label}: ${r.ata ? tr("cockpit.lateDep") : tr("cockpit.lateArr")}` };
  });
  const ls = shift.data?.[0];
  return {
    todayFlights, onGround: onGround.length, delayed: late.length,
    radar: { onGround: onGround.length, inbound: inbound.length, delayed: late.length, awaitingMsg: null },
    flightDecisions,
    memory: { activeFlights: live.length, pendingEmails: emails.count ?? 0, openTasks: tasks.count ?? 0, awaiting: awaiting.count ?? 0,
      lastShift: ls ? { name: ls.shift_name, acknowledged: !!ls.acknowledged_at, at: ls.acknowledged_at ?? ls.generated_at } : null },
  };
}
