import { createClient } from "@/lib/supabase/server";
import { airlinePrefix, resolveAirlines, type Airline } from "@/lib/requests";

export { TRACK_AR } from "@/lib/flight-labels";

export type FlightRow = {
  rotationId: string; flightIn: string | null; flightOut: string | null; registration: string | null; origin: string | null; station: string | null; destination: string | null;
  sta: string | null; std: string | null; eta: string | null; ata: string | null; atd: string | null; status: string;
  stepsTotal: number | null; stepsRecorded: number | null; criticalOpen: number | null; airline: Airline | null;
};
export type StepRow = {
  track: string; seq: number; code: string; nameAr: string; nameEn: string; kind: string; isCritical: boolean; templateStatus: string;
  plannedAt: string | null; actualAt: string | null; state: "recorded" | "open" | "not_recorded"; variance: number | null; eventId: string | null; wasCorrected: boolean; by: string | null;
};
export type Question = { id: string; step: string; text: string; dueAt: string | null; status: string; note: string | null };
export type DelayCode = { id: string; label: string };
export type Statement = { id: string; step: string | null; minutes: number | null; reason: string; code: string | null; by: string | null; at: string };
export type MessageType = { type: string; title: string | null; composable: boolean };

type Raw = Record<string, any>;

export async function getFlightList(tab: "active" | "done"): Promise<FlightRow[]> {
  const sb = await createClient();
  const q = sb.from("v_flight_file").select("*");
  const { data } = tab === "active"
    ? await q.is("atd", null).neq("status", "cancelled").order("sta", { ascending: true, nullsFirst: false }).limit(200)
    : await q.or("atd.not.is.null,status.eq.cancelled").order("std", { ascending: false, nullsFirst: false }).limit(50);
  const rows = (data ?? []) as Raw[];
  const airlines = await resolveAirlines(rows.map((r) => r.flight_in ?? r.flight_out));
  return rows.map((r) => {
    const p = airlinePrefix(r.flight_in ?? r.flight_out); const key = p.iata ?? p.icao;
    return {
      rotationId: r.rotation_id, flightIn: r.flight_in, flightOut: r.flight_out, registration: r.registration, origin: r.origin, station: r.station, destination: r.destination,
      sta: r.sta, std: r.std, eta: r.eta, ata: r.ata, atd: r.atd, status: r.status,
      stepsTotal: r.sop_steps_total === null ? null : Number(r.sop_steps_total), stepsRecorded: r.sop_steps_recorded === null ? null : Number(r.sop_steps_recorded),
      criticalOpen: r.sop_critical_open === null ? null : Number(r.sop_critical_open), airline: key ? airlines.get(key) ?? { code: key, name: null, logoUrl: null } : null,
    };
  });
}

export async function getFlight(rotationId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [{ data: f }, { data: clock }] = await Promise.all([
    sb.from("v_flight_file").select("*").eq("rotation_id", rotationId).maybeSingle(),
    sb.from("v_ground_clock").select("*").eq("rotation_id", rotationId).maybeSingle(),
  ]);
  if (!f || !clock) return null;
  const legs = [clock.arrival_leg_id, clock.departure_leg_id] as string[];
  const [tl, qs, st, dcs, mts, mem] = await Promise.all([
    sb.from("v_flight_timeline").select("*").in("flight_id", legs).order("track_order").order("seq"),
    sb.from("turnaround_checkins").select("id, step_code, question_ar, due_at, status, note").eq("flight_id", clock.departure_leg_id).in("status", ["asked", "in_progress", "late", "escalated"]).order("due_at"),
    sb.from("flight_delay_statements").select("id, step_code, delay_code_id, delay_minutes, reason_text, stated_by_employee_id, stated_at, supersedes_id").in("flight_id", legs).order("stated_at", { ascending: false }),
    sb.from("delay_codes").select("id, scheme, code, description").order("scheme").order("code"),
    sb.from("message_formats").select("message_type, title, composable").neq("status", "retired").order("message_type"),
    user ? sb.from("memberships").select("id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null as { id: string } | null }),
  ]);
  const me = mem.data ? (await sb.from("employees").select("id").eq("membership_id", mem.data.id).eq("active", true).maybeSingle()).data : null;
  const empIds = [...new Set((st.data ?? []).map((s) => s.stated_by_employee_id).filter(Boolean))];
  const emps = empIds.length ? (await sb.from("employees").select("id, full_name").in("id", empIds)).data ?? [] : [];
  const codes = dcs.data ?? [];
  const replaced = new Set((st.data ?? []).map((s) => s.supersedes_id).filter(Boolean));

  const steps: StepRow[] = (tl.data ?? []).map((t: Raw) => ({
    track: t.track, seq: t.seq, code: t.step_code, nameAr: t.name_ar, nameEn: t.name_en, kind: t.kind, isCritical: !!t.is_critical, templateStatus: t.template_status,
    plannedAt: t.planned_at, actualAt: t.actual_at, state: t.state, variance: t.variance_minutes, eventId: t.event_id, wasCorrected: !!t.was_corrected, by: t.recorded_by_label,
  }));
  const questions: Question[] = (qs.data ?? []).map((q) => ({ id: q.id, step: q.step_code, text: q.question_ar, dueAt: q.due_at, status: q.status, note: q.note }));
  const statements: Statement[] = (st.data ?? []).filter((s) => !replaced.has(s.id)).map((s) => {
    const c = codes.find((x) => x.id === s.delay_code_id);
    return { id: s.id, step: s.step_code, minutes: s.delay_minutes, reason: s.reason_text, code: c ? `${c.code} ${c.description}` : null, by: emps.find((e) => e.id === s.stated_by_employee_id)?.full_name ?? null, at: s.stated_at };
  });
  const delayCodes: DelayCode[] = codes.map((c) => ({ id: c.id, label: `${c.scheme} ${c.code} — ${c.description}` }));
  const messageTypes: MessageType[] = (mts.data ?? []).map((m) => ({ type: m.message_type, title: m.title, composable: !!m.composable }));
  const airlines = await resolveAirlines([f.flight_in ?? f.flight_out]);
  const p = airlinePrefix(f.flight_in ?? f.flight_out); const key = p.iata ?? p.icao;

  return {
    file: f as Raw, clock: clock as Raw, arrivalLeg: clock.arrival_leg_id as string, departureLeg: clock.departure_leg_id as string,
    steps, questions, statements, delayCodes, messageTypes, canAct: !!me,
    airline: key ? airlines.get(key) ?? { code: key, name: null, logoUrl: null } : null,
  };
}
