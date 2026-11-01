import { createClient } from "@/lib/supabase/server";

export const WAITING_AR: Record<string, string> = { employee: "الموظف", permits_dept: "قسم التصاريح", authority: "السلطة المدنية", airline: "شركة الطيران", none: "—" };
export const ACTOR_AR: Record<string, string> = { employee: "موظف", agent: "الوكيل", system: "النظام" };
export const TYPE_AR: Record<string, string> = { permit: "تصريح" };

export type Stage = { type: string; code: string; order: number; labelAr: string; labelEn: string; waitingOn: string; nextAr: string | null; nextEn: string | null; terminal: boolean };
export type Airline = { code: string; name: string | null; logoUrl: string | null };
export type RequestRow = {
  id: string; type: string; title: string; flightRef: string | null; flightDate: string | null; stage: string; stageLabelAr: string; waitingOn: string;
  status: string; urgent: boolean; ownerName: string | null; dueAt: string | null; hoursToDue: number | null; lastEventAt: string; lastEventSummary: string | null;
  hoursSince: number | null; nextAr: string | null; nextCustom: string | null; messageCount: number; airline: Airline | null;
};
export type TimelineItem = { at: string; toLabelAr: string | null; toStage: string; actor: string; note: string | null };
export type LinkedMail = { messageId: string; subject: string | null; from: string | null; at: string | null; triageId: string | null; direction: string | null };
export type AlertItem = { id: string; kind: "overdue" | "due" | "stalled"; severity: string; status: string; fileId: string | null; file: RequestRow | null; title: string };
export type Policy = { kind: string; stage: string | null; hours: number | null; status: string; source: string | null };
export type OpenFileOption = { id: string; title: string; flightRef: string | null; stageLabelAr: string };

/** IATA (2 chars, then a digit) or ICAO (3 letters, then a digit) airline prefix of a flight reference. */
function airlinePrefix(ref: string | null): { iata?: string; icao?: string } {
  if (!ref) return {};
  const s = ref.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]{3}\d/.test(s)) return { icao: s.slice(0, 3) };
  if (/^[A-Z0-9]{2}\d/.test(s)) return { iata: s.slice(0, 2) };
  return {};
}

async function resolveAirlines(refs: (string | null)[]): Promise<Map<string, Airline>> {
  const sb = await createClient();
  const pre = refs.map(airlinePrefix);
  const iata = [...new Set(pre.map((p) => p.iata).filter(Boolean))] as string[];
  const icao = [...new Set(pre.map((p) => p.icao).filter(Boolean))] as string[];
  const out = new Map<string, Airline>();
  if (!iata.length && !icao.length) return out;
  const [a, b] = await Promise.all([
    iata.length ? sb.from("airlines").select("id, iata_code, icao_code, name").in("iata_code", iata) : Promise.resolve({ data: [] as { id: string; iata_code: string | null; icao_code: string | null; name: string | null }[] }),
    icao.length ? sb.from("airlines").select("id, iata_code, icao_code, name").in("icao_code", icao) : Promise.resolve({ data: [] as { id: string; iata_code: string | null; icao_code: string | null; name: string | null }[] }),
  ]);
  const rows = [...(a.data ?? []), ...(b.data ?? [])];
  const ca = rows.length ? await sb.from("company_airlines").select("airline_id, logo_path").in("airline_id", rows.map((r) => r.id)) : { data: [] as { airline_id: string; logo_path: string | null }[] };
  const paths = (ca.data ?? []).map((c) => c.logo_path).filter(Boolean) as string[];
  const signed = paths.length ? await sb.storage.from("logos").createSignedUrls(paths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlOf = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  for (const p of pre) {
    const key = p.iata ?? p.icao; if (!key || out.has(key)) continue;
    const row = rows.find((r) => (p.iata ? r.iata_code === p.iata : r.icao_code === p.icao));
    const logo = row ? (ca.data ?? []).find((c) => c.airline_id === row.id)?.logo_path ?? null : null;
    out.set(key, { code: key, name: row?.name ?? null, logoUrl: logo ? urlOf.get(logo) ?? null : null });
  }
  return out;
}

export async function getStages() {
  const sb = await createClient();
  const [s, t] = await Promise.all([
    sb.from("request_stages").select("request_type, stage_code, sort_order, label_ar, label_en, waiting_on, next_action_ar, next_action_en, is_terminal").order("sort_order"),
    sb.from("request_stage_transitions").select("request_type, from_stage, to_stage"),
  ]);
  const stages: Stage[] = (s.data ?? []).map((x) => ({ type: x.request_type, code: x.stage_code, order: x.sort_order, labelAr: x.label_ar, labelEn: x.label_en, waitingOn: x.waiting_on, nextAr: x.next_action_ar, nextEn: x.next_action_en, terminal: x.is_terminal }));
  return { stages, transitions: (t.data ?? []).map((x) => ({ type: x.request_type, from: x.from_stage, to: x.to_stage })) };
}

type Raw = Record<string, any>; // rows of v_request_files

async function shape(rows: Raw[], stages: Stage[]): Promise<RequestRow[]> {
  if (!rows.length) return [];
  const sb = await createClient();
  const ownerIds = [...new Set(rows.map((r) => r.owner_employee_id).filter(Boolean))];
  const [emps, airlines] = await Promise.all([
    ownerIds.length ? sb.from("employees").select("id, full_name").in("id", ownerIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    resolveAirlines(rows.map((r) => r.flight_ref)),
  ]);
  return rows.map((r) => {
    const st = stages.find((x) => x.type === r.request_type && x.code === r.current_stage);
    const p = airlinePrefix(r.flight_ref); const key = p.iata ?? p.icao;
    const custom = r.next_action && r.next_action !== st?.nextEn ? (r.next_action as string) : null;
    return {
      id: r.id, type: r.request_type, title: r.title, flightRef: r.flight_ref, flightDate: r.flight_date, stage: r.current_stage, stageLabelAr: r.stage_label_ar, waitingOn: r.waiting_on,
      status: r.status, urgent: r.urgent, ownerName: emps.data?.find((e) => e.id === r.owner_employee_id)?.full_name ?? null, dueAt: r.due_at, hoursToDue: r.hours_to_due === null ? null : Number(r.hours_to_due),
      lastEventAt: r.last_event_at, lastEventSummary: r.last_event_summary, hoursSince: r.hours_since_last_event === null ? null : Number(r.hours_since_last_event),
      nextAr: st?.nextAr ?? null, nextCustom: custom, messageCount: Number(r.message_count ?? 0), airline: key ? airlines.get(key) ?? { code: key, name: null, logoUrl: null } : null,
    };
  });
}

export async function getRequestList(tab: "open" | "done") {
  const sb = await createClient();
  const { stages } = await getStages();
  const q = sb.from("v_request_files").select("*");
  const { data } = tab === "open"
    ? await q.eq("status", "open").order("urgent", { ascending: false }).order("due_at", { ascending: true, nullsFirst: false }).limit(200)
    : await q.neq("status", "open").order("last_event_at", { ascending: false }).limit(50);
  return shape(data ?? [], stages);
}

export async function getRequest(id: string) {
  const sb = await createClient();
  const { stages } = await getStages();
  const { data: d } = await sb.from("v_request_file_detail").select("*").eq("request_file_id", id).maybeSingle();
  if (!d) return null;
  const { data: v } = await sb.from("v_request_files").select("*").eq("id", id).maybeSingle();
  if (!v) return null;
  const [row] = await shape([v], stages);
  const [tl, ms] = await Promise.all([
    sb.from("v_request_file_timeline").select("occurred_at, to_stage, to_label_ar, actor_kind, note").eq("request_file_id", id).order("occurred_at", { ascending: false }),
    sb.from("v_request_file_messages").select("message_id, linked_at").eq("request_file_id", id).order("linked_at", { ascending: true }),
  ]);
  const ids = (ms.data ?? []).map((m) => m.message_id);
  const [mail, tri] = ids.length ? await Promise.all([
    sb.from("email_messages").select("id, subject, from_address, received_at, sent_at, direction").in("id", ids),
    sb.from("email_triage").select("id, message_id").in("message_id", ids),
  ]) : [{ data: [] as Raw[] }, { data: [] as Raw[] }];
  const timeline: TimelineItem[] = (tl.data ?? []).map((t) => ({ at: t.occurred_at, toStage: t.to_stage, toLabelAr: t.to_label_ar, actor: t.actor_kind, note: t.note }));
  const mails: LinkedMail[] = ids.map((mid) => {
    const m = (mail.data ?? []).find((x: Raw) => x.id === mid);
    return { messageId: mid, subject: m?.subject ?? null, from: m?.from_address ?? null, at: m?.received_at ?? m?.sent_at ?? null, direction: m?.direction ?? null, triageId: (tri.data ?? []).find((t: Raw) => t.message_id === mid)?.id ?? null };
  });
  return { row, timeline, mails, permit: d.permit_id ? { number: d.permit_number as string | null, status: d.permit_status as string | null, from: d.permit_valid_from as string | null, to: d.permit_valid_to as string | null } : null };
}

export async function getAlerts(): Promise<AlertItem[]> {
  const sb = await createClient();
  const { data } = await sb.from("exceptions").select("id, severity, status, title, source_type, source_id").in("source_type", ["request_due", "request_stalled"]).in("status", ["open", "acknowledged"]).order("severity", { ascending: true });
  if (!data?.length) return [];
  const { stages } = await getStages();
  const { data: files } = await sb.from("v_request_files").select("*").in("id", data.map((e) => e.source_id));
  const rows = await shape(files ?? [], stages);
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return data.map((e) => ({
    id: e.id, severity: e.severity, status: e.status, fileId: e.source_id, file: rows.find((r) => r.id === e.source_id) ?? null, title: e.title,
    kind: e.source_type === "request_stalled" ? "stalled" as const : String(e.title).startsWith("Request overdue") ? "overdue" as const : "due" as const,
  })).sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export async function getPolicies(): Promise<Policy[]> {
  const sb = await createClient();
  const { data } = await sb.from("request_policies").select("policy_kind, stage_code, hours, status, source_ref").neq("status", "retired");
  return (data ?? []).map((p) => ({ kind: p.policy_kind, stage: p.stage_code, hours: p.hours === null ? null : Number(p.hours), status: p.status, source: p.source_ref }));
}

/** For the inbox: files linked to one message, and the open files an email could be linked to. */
export async function getFilesForMessage(messageId: string) {
  const sb = await createClient();
  const { stages } = await getStages();
  const [link, open] = await Promise.all([
    sb.from("request_file_messages").select("request_file_id").eq("message_id", messageId),
    sb.from("v_request_files").select("id, title, flight_ref, stage_label_ar, current_stage, request_type").eq("status", "open").order("last_event_at", { ascending: false }).limit(100),
  ]);
  const linkedIds = (link.data ?? []).map((l) => l.request_file_id as string);
  const linkedRows = linkedIds.length ? (await sb.from("v_request_files").select("id, title, flight_ref, stage_label_ar").in("id", linkedIds)).data ?? [] : [];
  const toOpt = (f: Record<string, any>) => ({ id: f.id as string, title: f.title as string, flightRef: f.flight_ref as string | null, stageLabelAr: f.stage_label_ar as string });
  const linkedSet = new Set(linkedIds);
  const all = (open.data ?? []).filter((f) => !linkedSet.has(f.id)).map(toOpt);
  void stages;
  return { linked: linkedRows.map(toOpt), linkable: all as OpenFileOption[] };
}
