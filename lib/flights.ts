import { createClient } from "@/lib/supabase/server";
import { airlinePrefix, resolveAirlines, type Airline } from "@/lib/requests";

export type FlightType = "commercial" | "private" | "cargo" | "medevac";
const TYPE_RANK: Record<FlightType, number> = { commercial: 0, cargo: 1, private: 2, medevac: 3 };
const asType = (v: unknown): FlightType => (v === "private" || v === "cargo" || v === "medevac" ? v : "commercial");
/** نوع الدوران = أعلى نوع بين ساقيه (إسعاف ثم خاصة ثم شحن ثم تجارية) */
const topType = (types: unknown[]): FlightType => types.map(asType).reduce<FlightType>((m, t) => (TYPE_RANK[t] > TYPE_RANK[m] ? t : m), "commercial");

export type TypeSuggestion = { id: string; type: FlightType; evidence: string; at: string };

export type FlightRow = {
  rotationId: string; flightIn: string | null; flightOut: string | null; registration: string | null; origin: string | null; station: string | null; destination: string | null;
  sta: string | null; std: string | null; eta: string | null; ata: string | null; atd: string | null; status: string;
  stepsTotal: number | null; stepsRecorded: number | null; criticalOpen: number | null; airline: Airline | null;
  /** رحلة تاريخها قبل اليوم ولم تُغلق (لا وقت مغادرة فعلي) */
  stale: boolean;
  /** علامة واحدة للرحلة: أعلى مستوى تنبيه مفتوح، ومهمة ED/NI إن وُجدت (من flights_attention) */
  attn: Attn | null;
  /** نوع الرحلة: تجارية / خاصة / شحن / إسعاف */
  flightType: FlightType;
};
export type Attn = { level: string | null; alerts: number; due: { type: string; isDue: boolean; at: string | null } | null };
const LV: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4 };
export const needsAction = (r: { attn: Attn | null }) => !!r.attn && (r.attn.alerts > 0 || !!r.attn.due?.isDue);

export type StepRow = {
  track: string; seq: number; code: string; nameAr: string; nameEn: string; kind: string; isCritical: boolean; templateStatus: string;
  plannedAt: string | null; actualAt: string | null; state: "recorded" | "open" | "not_recorded"; variance: number | null; eventId: string | null; wasCorrected: boolean; by: string | null;
};
export type Question = { id: string; step: string; text: string; dueAt: string | null; status: string; note: string | null };
export type DelayCode = { id: string; label: string; scheme: string; code: string; description: string };
export type Statement = { id: string; step: string | null; minutes: number | null; reason: string; code: string | null; by: string | null; at: string };
export type FlightMail = { triageId: string; subject: string | null; from: string | null; at: string | null; summary: string | null; action: string | null; status: string; draft: { id: string; status: string; at: string } | null };
export type FlightRqm = { id: string; status: string; body: string; createdAt: string; sentAt: string | null; followup: boolean; warnings: string[] };
export type SpecField = { field: string; label: string; format: string };
export type PanelMessage = { type: string; title: string | null; composable: boolean; flightLookup: boolean; required: SpecField[]; optional: SpecField[] };
export type NeededItem =
  | { kind: "alert"; id: string; level: string; reason: string; action: string; dueAt: string | null }
  | { kind: "message_due"; type: string; isDue: boolean; dueAt: string | null; suggested: string | null; forFlightId: string | null };
export type PanelDraft = { id: string; type: string; status: string; body: string; warnings: string[]; createdAt: string; sentAt: string | null };
export type Panel = { needed: NeededItem[]; messages: PanelMessage[]; drafts: PanelDraft[] };

type Raw = Record<string, any>;

export async function getFlightList(tab: "active" | "done", companyId: string): Promise<FlightRow[]> {
  const sb = await createClient();
  // قائمة خفيفة: بدون أعمدة sop_* لأنها تأخذ ~9 ثوانٍ (انتهاء مهلة الاستعلام) وتجعل القائمة فاضية؛ العدّادات موجودة في صفحة الرحلة نفسها
  const q = sb.from("v_flight_file").select("company_id, rotation_id, flight_in, flight_out, date_in, date_out, registration, origin, station, destination, sta, std, eta, ata, atd, status");
  const { data } = tab === "active"
    ? await q.is("atd", null).neq("status", "cancelled").order("sta", { ascending: true, nullsFirst: false }).limit(200)
    : await q.or("atd.not.is.null,status.eq.cancelled").order("std", { ascending: false, nullsFirst: false }).limit(50);
  const today = new Date().toISOString().slice(0, 10);
  const isStale = (r: Raw) => tab === "active" && !r.atd && String(r.date_out ?? r.date_in ?? "9999") < today;
  const all = (data ?? []) as Raw[];
  // الحالية: رحلات اليوم وما بعدها أولاً (الأقرب فالأبعد)، ثم القديمة غير المغلقة (الأحدث فالأقدم)
  const rows = tab === "active"
    ? [...all.filter((r) => !isStale(r)), ...all.filter(isStale).reverse()]
    : all;
  const [airlines, { data: legsData }, { data: attnData }, { data: typeData }] = await Promise.all([
    resolveAirlines(rows.map((r) => r.flight_in ?? r.flight_out)),
    sb.from("v_ground_clock").select("rotation_id, arrival_leg_id, departure_leg_id").limit(2000),
    sb.rpc("flights_attention", { p_company_id: companyId }),
    // الرحلات غير التجارية فقط (قليلة): تكفي لمعرفة نوع كل دوران
    sb.from("flights").select("id, operator_type").neq("operator_type", "commercial").limit(2000),
  ]);
  const nonCommercial = new Map<string, unknown>(((typeData ?? []) as Raw[]).map((x) => [x.id, x.operator_type]));
  const legsOf = new Map<string, string[]>(((legsData ?? []) as Raw[]).map((g) => [g.rotation_id, [g.arrival_leg_id, g.departure_leg_id]]));
  const attnRows = (attnData ?? []) as Raw[];
  const attnOf = (rotationId: string): Attn | null => {
    const legs = legsOf.get(rotationId) ?? [];
    const mine = attnRows.filter((a) => legs.includes(a.flight_id));
    if (mine.length === 0) return null;
    const level = mine.reduce<string | null>((m, a) => (a.max_level && (LV[a.max_level] ?? 0) > (m ? LV[m] ?? 0 : 0) ? a.max_level : m), null);
    const alerts = mine.reduce((n, a) => n + Number(a.open_alerts ?? 0), 0);
    const d = mine.filter((a) => a.message_due_type).sort((a, b) => Number(!!b.message_is_due) - Number(!!a.message_is_due))[0];
    return { level, alerts, due: d ? { type: String(d.message_due_type), isDue: !!d.message_is_due, at: d.message_due_at ?? null } : null };
  };
  const out = rows.map((r) => {
    const p = airlinePrefix(r.flight_in ?? r.flight_out); const key = p.iata ?? p.icao;
    return {
      stale: isStale(r), attn: attnOf(r.rotation_id), flightType: topType((legsOf.get(r.rotation_id) ?? []).map((id) => nonCommercial.get(id))),
      rotationId: r.rotation_id, flightIn: r.flight_in, flightOut: r.flight_out, registration: r.registration, origin: r.origin, station: r.station, destination: r.destination,
      sta: r.sta, std: r.std, eta: r.eta, ata: r.ata, atd: r.atd, status: r.status,
      stepsTotal: r.sop_steps_total === null ? null : Number(r.sop_steps_total), stepsRecorded: r.sop_steps_recorded === null ? null : Number(r.sop_steps_recorded),
      criticalOpen: r.sop_critical_open === null ? null : Number(r.sop_critical_open), airline: key ? airlines.get(key) ?? { code: key, name: null, logoUrl: null } : null,
    };
  });
  // الرحلات المحتاجة تصرف فوق (الأعلى مستوى أولاً)؛ باقي الرحلات هادية وبترتيبها
  // رحلة الإسعاف دائماً في أعلى القائمة، قبل أي تنبيه
  const rank = (r: FlightRow) => (r.flightType === "medevac" ? 0 : needsAction(r) ? 10 - (LV[r.attn?.level ?? ""] ?? 0) : 99);
  return tab === "active" ? out.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r) : out;
}

const toPanel = (arr: Raw | null, dep: Raw | null): Panel => {
  if (!arr || arr.status !== "ok") return { needed: [], messages: [], drafts: [] };
  const fromAlert = (x: Raw): NeededItem => ({ kind: "alert", id: x.alert_id, level: x.level, reason: x.reason_ar, action: x.action_ar, dueAt: x.due_at ?? null });
  const needed: NeededItem[] = [
    ...((arr.needed_now ?? []) as Raw[]).map((x): NeededItem => x.kind === "alert" ? fromAlert(x)
      : { kind: "message_due", type: x.message_type, isDue: !!x.is_due, dueAt: x.due_at ?? null, suggested: x.suggested_time_value ?? null, forFlightId: x.for_flight_id ?? null }),
    ...(dep && dep.status === "ok" ? ((dep.needed_now ?? []) as Raw[]).filter((x) => x.kind === "alert").map(fromAlert) : []),
  ].sort((a, b) => (a.kind === "alert" ? 10 - (LV[a.level] ?? 0) : 5) - (b.kind === "alert" ? 10 - (LV[b.level] ?? 0) : 5));
  const messages: PanelMessage[] = ((arr.messages ?? []) as Raw[]).map((m) => ({ type: m.type, title: m.title, composable: !!m.composable, flightLookup: !!m.flight_lookup, required: m.required ?? [], optional: m.optional ?? [] }));
  const drafts: PanelDraft[] = ((arr.drafts ?? []) as Raw[]).map((d) => ({
    id: d.id, type: d.message_type, status: d.status, body: d.body_text, createdAt: d.created_at, sentAt: d.sent_at ?? null,
    warnings: (Array.isArray(d.warnings) ? d.warnings : []).map((w: unknown) => typeof w === "string" ? w : String((w as { message?: string })?.message ?? "")).filter(Boolean),
  }));
  return { needed, messages, drafts };
};

export async function getFlight(rotationId: string, companyId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const [{ data: f }, { data: clock }] = await Promise.all([
    sb.from("v_flight_file").select("*").eq("rotation_id", rotationId).maybeSingle(),
    sb.from("v_ground_clock").select("*").eq("rotation_id", rotationId).maybeSingle(),
  ]);
  if (!f || !clock) return null;
  const legs = [clock.arrival_leg_id, clock.departure_leg_id] as string[];
  const { data: sugData } = await sb.from("flight_type_suggestions").select("id, suggested_type, evidence_text, created_at").in("flight_id", legs).eq("status", "pending").order("created_at", { ascending: false });
  const typeSuggestions: TypeSuggestion[] = ((sugData ?? []) as Raw[]).map((x) => ({ id: x.id, type: asType(x.suggested_type), evidence: String(x.evidence_text ?? ""), at: x.created_at }));
  const { data: legTypes } = await sb.from("flights").select("operator_type, type_source").in("id", legs);
  const flightType = topType((legTypes ?? []).map((x: Raw) => x.operator_type));
  const typeSource: string = (legTypes ?? []).find((x: Raw) => asType(x.operator_type) === flightType)?.type_source ?? "schedule";
  const [tl, qs, st, dcs, pArr, pDep, mem] = await Promise.all([
    sb.from("v_flight_timeline").select("*").in("flight_id", legs).order("track_order").order("seq"),
    sb.from("turnaround_checkins").select("id, step_code, question_ar, due_at, status, note").eq("flight_id", clock.departure_leg_id).in("status", ["asked", "in_progress", "late", "escalated"]).order("due_at"),
    sb.from("flight_delay_statements").select("id, step_code, delay_code_id, delay_minutes, reason_text, stated_by_employee_id, stated_at, supersedes_id").in("flight_id", legs).order("stated_at", { ascending: false }),
    sb.from("delay_codes").select("id, scheme, code, description").order("scheme").order("code"),
    sb.rpc("flight_message_panel", { p_company_id: companyId, p_flight_id: clock.arrival_leg_id }),
    sb.rpc("flight_message_panel", { p_company_id: companyId, p_flight_id: clock.departure_leg_id }),
    user ? sb.from("memberships").select("id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null as { id: string } | null }),
  ]);
  const { data: tri } = await sb.from("email_triage").select("id, summary, requested_action, status, created_at, message_id").in("flight_id", legs).order("created_at", { ascending: false }).limit(50);
  const triIds = (tri ?? []).map((t) => t.id);
  const [mm, dr] = triIds.length ? await Promise.all([
    sb.from("email_messages").select("id, from_address, subject, received_at, sent_at").in("id", (tri ?? []).map((t) => t.message_id)),
    sb.from("email_reply_drafts").select("id, triage_id, status, created_at").in("triage_id", triIds).neq("status", "superseded").order("created_at", { ascending: false }),
  ]) : [{ data: [] as Raw[] }, { data: [] as Raw[] }];
  const mails: FlightMail[] = (tri ?? []).map((t) => {
    const m = (mm.data ?? []).find((x: Raw) => x.id === t.message_id); const d = (dr.data ?? []).find((x: Raw) => x.triage_id === t.id);
    return { triageId: t.id, subject: m?.subject ?? null, from: m?.from_address ?? null, at: m?.received_at ?? m?.sent_at ?? t.created_at, summary: t.summary, action: t.requested_action, status: t.status, draft: d ? { id: d.id, status: d.status, at: d.created_at } : null };
  });
  const { data: rq } = await sb.from("message_drafts").select("id, status, body_text, created_at, sent_at, followup_of, warnings").in("flight_id", legs).eq("message_type", "RQM").in("status", ["draft", "approved"]).order("created_at", { ascending: false }).limit(5);
  const rqms: FlightRqm[] = (rq ?? []).filter((x) => x.status === "draft" || (x.sent_at && x.status === "approved")).map((x) => ({
    id: x.id, status: x.status, body: x.body_text, createdAt: x.created_at, sentAt: x.sent_at, followup: !!x.followup_of,
    warnings: (Array.isArray(x.warnings) ? x.warnings : []).map((w: unknown) => typeof w === "string" ? w : String((w as { message?: string })?.message ?? "")).filter(Boolean),
  }));
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
  const delayCodes: DelayCode[] = codes.map((c) => ({ id: c.id, label: `${c.scheme} ${c.code} — ${c.description}`, scheme: c.scheme, code: c.code, description: c.description }));
  const panel = toPanel((pArr.data ?? null) as Raw | null, (pDep.data ?? null) as Raw | null);
  const airlines = await resolveAirlines([f.flight_in ?? f.flight_out]);
  const p = airlinePrefix(f.flight_in ?? f.flight_out); const key = p.iata ?? p.icao;

  return {
    file: f as Raw, clock: clock as Raw, arrivalLeg: clock.arrival_leg_id as string, departureLeg: clock.departure_leg_id as string,
    steps, questions, statements, delayCodes, panel, mails, rqms, canAct: !!me, flightType, typeSource, typeSuggestions,
    airline: key ? airlines.get(key) ?? { code: key, name: null, logoUrl: null } : null,
  };
}
