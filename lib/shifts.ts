import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";

export type ShiftDef = { id: string; name: string; startMinute: number; durationMinutes: number; active: boolean };
export type RepRequest = { id: string; title: string; flightRef: string | null; stageLabelAr: string | null; stageLabel?: string | null; dueAt: string | null; urgent: boolean; ownerName: string | null; lastEventAt: string | null; lastEventSummary: string | null };
export type RepAlert = { id: string; severity: string; status: string; title: string; detectedAt: string | null };
export type RepQuestion = { id: string; flightNumber: string | null; questionAr: string | null; questionEn: string | null; dueAt: string | null; status: string };
export type RepFlight = { key: string; flightIn: string | null; flightOut: string | null; registration: string | null; ata: string | null; std: string | null };
export type ReportContent = {
  requests: RepRequest[]; alerts: RepAlert[]; questions: RepQuestion[]; flights: RepFlight[];
  emails: { new: number | null; urgentNew: number | null; draftsWaiting: number | null };
  during: { events: number | null; delays: number | null };
};
export type ShiftReport = {
  id: string; shiftName: string; start: string; end: string; generatedAt: string; status: "generated" | "acknowledged";
  ackByName: string | null; ackAt: string | null; ackNote: string | null; tookCount: number | null; content: ReportContent;
};
export type LiveRequest = { status: string; stageLabelAr: string | null; stageLabel: string | null; ownerName: string | null };
export type ShiftPage = {
  companyId: string; role: string; hasEmployee: boolean; canAdmin: boolean; canWrite: boolean;
  defs: ShiftDef[]; nextReports: { name: string; generateAt: string; shiftEnd: string }[];
  reports: ShiftReport[]; sel: ShiftReport | null; live: Map<string, LiveRequest>;
};

const num = (v: unknown): number | null => (typeof v === "number" ? v : v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** The report is a database snapshot: every field is read defensively and a missing value stays null (shown as an em dash). */
export function parseContent(raw: unknown): ReportContent {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const e = (c.emails && typeof c.emails === "object" ? c.emails : {}) as Record<string, unknown>;
  const d = (c.during_shift && typeof c.during_shift === "object" ? c.during_shift : {}) as Record<string, unknown>;
  return {
    requests: arr(c.requests).map((r) => ({ id: String(r.id), title: str(r.title) ?? "—", flightRef: str(r.flight_ref), stageLabelAr: str(r.stage_label_ar), dueAt: str(r.due_at), urgent: r.urgent === true, ownerName: str(r.owner_name), lastEventAt: str(r.last_event_at), lastEventSummary: str(r.last_event_summary) })),
    alerts: arr(c.alerts).map((a) => ({ id: String(a.id), severity: str(a.severity) ?? "", status: str(a.status) ?? "", title: str(a.title) ?? "—", detectedAt: str(a.detected_at) })),
    questions: arr(c.questions).map((q) => ({ id: String(q.id), flightNumber: str(q.flight_number), questionAr: str(q.question_ar), questionEn: str(q.question_en), dueAt: str(q.due_at), status: str(q.status) ?? "" })),
    flights: arr(c.flights_on_ground).map((f, i) => ({ key: String(f.rotation_id ?? i), flightIn: str(f.flight_in), flightOut: str(f.flight_out), registration: str(f.registration), ata: str(f.ata), std: str(f.std) })),
    emails: { new: num(e.new), urgentNew: num(e.urgent_new), draftsWaiting: num(e.drafts_waiting) },
    during: { events: num(d.events_recorded), delays: num(d.delay_statements) },
  };
}

/** When the next report of each active shift is generated (15 minutes before the shift ends). Derived only from the stored definitions. */
export function nextReportTimes(defs: ShiftDef[], now = new Date()) {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: { name: string; generateAt: string; shiftEnd: string }[] = [];
  for (const d of defs.filter((x) => x.active)) {
    let best: { gen: number; end: number } | null = null;
    for (let k = -1; k <= 2; k++) {
      const start = dayStart + k * 86400000 + d.startMinute * 60000;
      const end = start + d.durationMinutes * 60000;
      const gen = end - 15 * 60000;
      if (gen > now.getTime() && (!best || gen < best.gen)) best = { gen, end };
    }
    if (best) out.push({ name: d.name, generateAt: new Date(best.gen).toISOString(), shiftEnd: new Date(best.end).toISOString() });
  }
  return out.sort((a, b) => a.generateAt.localeCompare(b.generateAt));
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type RawReport = { id: string; shift_name: string; shift_start: string; shift_end: string; generated_at: string; status: string; acknowledged_at: string | null; ack_note: string | null; took_requests_count: number | null; content: unknown; acknowledged_by: { full_name: string | null } | { full_name: string | null }[] | null };
const SEL = "id, shift_name, shift_start, shift_end, generated_at, status, acknowledged_at, ack_note, took_requests_count, content, acknowledged_by:employees!acknowledged_by_employee_id(full_name)";
const toReport = (r: RawReport): ShiftReport => {
  const by = Array.isArray(r.acknowledged_by) ? r.acknowledged_by[0] : r.acknowledged_by;
  return { id: r.id, shiftName: r.shift_name, start: r.shift_start, end: r.shift_end, generatedAt: r.generated_at, status: r.status === "acknowledged" ? "acknowledged" : "generated", ackByName: by?.full_name ?? null, ackAt: r.acknowledged_at, ackNote: r.ack_note, tookCount: r.took_requests_count, content: parseContent(r.content) };
};

export async function getShiftPage(selectedId?: string): Promise<ShiftPage | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: m } = await sb.from("memberships").select("id, role, company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return null;

  const { lang } = await getT();
  const [emp, defsQ, listQ, stagesQ] = await Promise.all([
    sb.from("employees").select("id").eq("company_id", m.company_id).eq("membership_id", m.id).maybeSingle(),
    sb.from("shift_definitions").select("id, name, start_minute_utc, duration_minutes, active").order("start_minute_utc"),
    sb.from("shift_reports").select(SEL).order("shift_end", { ascending: false }).limit(20),
    sb.from("request_stages").select("request_type, stage_code, label_ar, label_en"),
  ]);
  // Stage names come from request_stages (label_ar / label_en). The report snapshot only stores the Arabic label, so map it back.
  const stages = stagesQ.data ?? [];
  const stageName = (ar: string | null) => (!ar || lang === "ar" ? ar : stages.find((s) => s.label_ar === ar)?.label_en ?? ar);
  const defs: ShiftDef[] = (defsQ.data ?? []).map((d) => ({ id: d.id, name: d.name, startMinute: d.start_minute_utc, durationMinutes: d.duration_minutes, active: d.active }));
  const reports = ((listQ.data ?? []) as unknown as RawReport[]).map(toReport);

  let sel = reports.find((r) => r.id === selectedId) ?? null;
  if (!sel && selectedId) { const one = await sb.from("shift_reports").select(SEL).eq("id", selectedId).maybeSingle(); if (one.data) sel = toReport(one.data as unknown as RawReport); }
  // Default: the newest report still waiting for acknowledgement, otherwise the newest one.
  if (!sel) sel = reports.find((r) => r.status === "generated") ?? reports[0] ?? null;
  if (sel) sel.content.requests = sel.content.requests.map((r) => ({ ...r, stageLabel: stageName(r.stageLabelAr) }));

  // Follow-up of open cases: where are the requests of this snapshot right now?
  const live = new Map<string, LiveRequest>();
  const ids = sel ? sel.content.requests.map((r) => r.id) : [];
  if (ids.length) {
    const { data: rows } = await sb.from("request_files").select("id, status, current_stage, request_type, owner_employee_id").in("id", ids);
    const owners = [...new Set((rows ?? []).map((r) => r.owner_employee_id).filter(Boolean))] as string[];
    const names = owners.length ? await sb.from("employees").select("id, full_name").in("id", owners) : { data: [] as { id: string; full_name: string | null }[] };
    const nameOf = new Map((names.data ?? []).map((n) => [n.id, n.full_name]));
    for (const r of rows ?? []) live.set(r.id, { status: r.status, stageLabelAr: stages.find((s) => s.request_type === r.request_type && s.stage_code === r.current_stage)?.label_ar ?? null, stageLabel: ((s) => (s ? (lang === "ar" ? s.label_ar : s.label_en ?? s.label_ar) : null))(stages.find((s) => s.request_type === r.request_type && s.stage_code === r.current_stage)), ownerName: r.owner_employee_id ? nameOf.get(r.owner_employee_id) ?? null : null });
  }

  return { companyId: m.company_id, role: m.role, hasEmployee: !!emp.data, canAdmin: m.role === "owner" || m.role === "admin", canWrite: m.role !== "viewer", defs, nextReports: nextReportTimes(defs), reports, sel, live };
}

export async function countPendingReports(): Promise<number> {
  const sb = await createClient();
  const { count } = await sb.from("shift_reports").select("id", { count: "exact", head: true }).eq("status", "generated");
  return count ?? 0;
}
