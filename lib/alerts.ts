import { createClient } from "@/lib/supabase/server";

export type Scope = "home" | "flights" | "inbox" | "requests" | "handover" | "agent";
export type BellItem = { id: string; tone: "late" | "warn" | "info"; text: string; sub?: string; href: string };

type Sb = Awaited<ReturnType<typeof createClient>>;
const rank = { late: 0, warn: 1, info: 2 } as const;
const byTone = (a: BellItem, b: BellItem) => rank[a.tone] - rank[b.tone];
const flightLabel = (r: { flight_in?: string | null; flight_out?: string | null }) => [r.flight_in, r.flight_out].filter(Boolean).join(" / ") || "—";

/** Open request alerts (due soon / overdue / stalled), created by the database rules. */
async function requestItems(sb: Sb): Promise<BellItem[]> {
  const { data } = await sb.from("exceptions").select("id, severity, title, source_id, source_type").in("source_type", ["request_due", "request_stalled"]).eq("status", "open").order("severity", { ascending: true }).limit(20);
  if (!data?.length) return [];
  const { data: files } = await sb.from("request_files").select("id, title").in("id", data.map((e) => e.source_id));
  const title = new Map((files ?? []).map((f) => [f.id as string, f.title as string]));
  return data.map((e) => ({
    id: `req-${e.id}`, tone: e.severity === "high" ? "late" as const : "warn" as const, href: `/requests?id=${e.source_id}`, sub: title.get(e.source_id),
    text: e.source_type === "request_stalled" ? "طلب راكد بلا حركة" : String(e.title).startsWith("Request overdue") ? "طلب تجاوز موعده" : "طلب يقترب موعده",
  }));
}

/** New urgent emails and replies the agent drafted that wait for a human decision. */
async function inboxItems(sb: Sb): Promise<BellItem[]> {
  const [urgent, drafts] = await Promise.all([
    sb.from("email_triage").select("id, summary").eq("status", "new").eq("urgency", "urgent").order("created_at", { ascending: false }).limit(20),
    sb.from("email_reply_drafts").select("id, triage_id, subject").eq("status", "draft").order("created_at", { ascending: false }).limit(20),
  ]);
  const urgentIds = new Set((urgent.data ?? []).map((t) => t.id as string));
  return [
    ...(urgent.data ?? []).map((t) => ({ id: `mail-${t.id}`, tone: "late" as const, text: "إيميل عاجل جديد", sub: t.summary ?? undefined, href: `/inbox?id=${t.id}` })),
    ...(drafts.data ?? []).filter((d) => !urgentIds.has(d.triage_id)).map((d) => ({ id: `draft-${d.id}`, tone: "info" as const, text: "مسودة رد تنتظر مراجعتك", sub: d.subject ?? undefined, href: `/inbox?id=${d.triage_id}` })),
  ];
}

/** Flights around today that are not yet departed: late arrivals, late agent questions, critical steps still open while the aircraft is on the ground. */
async function flightItems(sb: Sb): Promise<BellItem[]> {
  const now = Date.now();
  const from = new Date(now - 24 * 3600e3).toISOString(); const to = new Date(now + 36 * 3600e3).toISOString();
  const { data: act } = await sb.from("v_flight_file").select("rotation_id, flight_in, flight_out, ata, status, sop_critical_open").is("atd", null).neq("status", "cancelled").gte("sta", from).lte("sta", to).order("sta", { ascending: true }).limit(100);
  const rows = act ?? [];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.rotation_id as string);
  const { data: clock } = await sb.from("v_ground_clock").select("rotation_id, arrival_delay_min, departure_leg_id").in("rotation_id", ids);
  const legs = (clock ?? []).map((c) => c.departure_leg_id as string).filter(Boolean);
  const { data: qs } = legs.length ? await sb.from("turnaround_checkins").select("id, flight_id, question_ar, status").in("flight_id", legs).in("status", ["late", "escalated"]).order("due_at").limit(20) : { data: [] as { id: string; flight_id: string; question_ar: string | null; status: string }[] };
  const rowOf = new Map(rows.map((r) => [r.rotation_id as string, r]));
  const rotOfLeg = new Map((clock ?? []).map((c) => [c.departure_leg_id as string, c.rotation_id as string]));
  const out: BellItem[] = [];
  for (const c of clock ?? []) {
    const d = Number(c.arrival_delay_min);
    if (Number.isFinite(d) && d > 0) out.push({ id: `delay-${c.rotation_id}`, tone: "warn", text: `تأخر وصول ${d} دقيقة`, sub: flightLabel(rowOf.get(c.rotation_id)!), href: `/flights?id=${c.rotation_id}` });
  }
  for (const q of qs ?? []) {
    const rot = rotOfLeg.get(q.flight_id); if (!rot) continue;
    out.push({ id: `q-${q.id}`, tone: "late", text: q.status === "escalated" ? "سؤال للوكيل تم تصعيده" : "سؤال للوكيل تأخر الرد عليه", sub: `${flightLabel(rowOf.get(rot)!)}${q.question_ar ? ` · ${q.question_ar}` : ""}`, href: `/flights?id=${rot}` });
  }
  for (const r of rows) {
    const n = Number(r.sop_critical_open);
    if (r.ata && Number.isFinite(n) && n > 0) out.push({ id: `crit-${r.rotation_id}`, tone: "warn", text: `على الأرض ومراحل حرجة مفتوحة: ${n}`, sub: flightLabel(r), href: `/flights?id=${r.rotation_id}` });
  }
  return out;
}

/** The bell is per page: it only counts what belongs to the page the employee is looking at. Home (and pages without their own list) show everything. */
export async function getBellItems(scope: Scope): Promise<BellItem[]> {
  const sb = await createClient();
  if (scope === "requests") return (await requestItems(sb)).sort(byTone);
  if (scope === "inbox") return (await inboxItems(sb)).sort(byTone);
  if (scope === "flights") return (await flightItems(sb)).sort(byTone);
  const [a, b, c] = await Promise.all([requestItems(sb), inboxItems(sb), flightItems(sb)]);
  return [...a, ...b, ...c].sort(byTone);
}
