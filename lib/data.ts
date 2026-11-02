import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

export type Tone = "late" | "warn" | "info" | "ok";
export type Decision = { id: string; tone: Tone; text: string; action: string; href?: string };
export type ActiveRequest = { id: string; airline: string; title: string; status: string; tone: Tone; next: string };
export type RadarCounts = { onGround: number | null; inbound: number | null; delayed: number | null; awaitingMsg: number | null };
export type CommandData = {
  noMembership: boolean;
  company: { id: string; name: string; kind: string; logoPath: string | null };
  user: { name: string; role: string };
  shadowMode: boolean;
  counts: { inboxToReview: number | null; draftsWaiting: number | null; urgentAlerts: number | null };
  radar: RadarCounts;
  decisions: Decision[];
  requests: ActiveRequest[];
};

const ROLE_KEY: Record<string, Key> = { owner: "data.role.owner", admin: "data.role.admin", operator: "data.role.operator", viewer: "data.role.viewer" };
const urgencyTone = (u: string | null): Tone => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");

/** Everything here is read through RLS: the signed-in user only ever sees their own company's rows. */
export async function getCommandData(): Promise<CommandData> {
  const sb = await createClient();
  const { t } = await getT();
  const { data: { user } } = await sb.auth.getUser();
  const empty: CommandData = {
    noMembership: true, company: { id: "", name: "SKYEYE", kind: "", logoPath: null }, user: { name: user?.email ?? "", role: "" },
    shadowMode: true, counts: { inboxToReview: null, draftsWaiting: null, urgentAlerts: null },
    radar: { onGround: null, inbound: null, delayed: null, awaitingMsg: null }, decisions: [], requests: [],
  };
  if (!user) return empty;

  const { data: m } = await sb.from("memberships").select("role, company_id, companies(id, name, logo_path)").eq("user_id", user.id).maybeSingle();
  const co = m && (Array.isArray(m.companies) ? m.companies[0] : m.companies);
  if (!m || !co) return empty;

  const [emp, inbox, drafts, urgent, triage, reqs, alerts, pendingShift] = await Promise.all([
    sb.from("employees").select("full_name, role_title").eq("company_id", m.company_id).eq("membership_id", (await sb.from("memberships").select("id").eq("user_id", user.id).single()).data?.id ?? "").maybeSingle(),
    sb.from("email_triage").select("id", { count: "exact", head: true }).eq("status", "new"),
    sb.from("email_reply_drafts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    sb.from("email_triage").select("id", { count: "exact", head: true }).eq("status", "new").eq("urgency", "urgent"),
    sb.from("email_triage").select("id, summary, urgency, needs_reply").eq("status", "new").order("created_at", { ascending: false }).limit(3),
    sb.from("request_files").select("id, title, flight_ref, current_stage, urgent, next_action, status").is("closed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(4),
    sb.from("exceptions").select("id, severity, title, source_id, source_type").in("source_type", ["request_due", "request_stalled"]).in("status", ["open"]).order("severity", { ascending: true }).limit(5),
    sb.from("shift_reports").select("id, shift_name", { count: "exact" }).eq("status", "generated").order("shift_end", { ascending: false }).limit(1),
  ]);
  const shiftDecisions: Decision[] = (pendingShift.data ?? []).map((r) => ({ id: `shift-${r.id}`, tone: "warn", href: `/handover?id=${r.id}`, action: t("data.shift.open"), text: (pendingShift.count ?? 1) > 1 ? t("data.shift.many", { n: pendingShift.count ?? 0 }) : t("data.shift.one", { name: r.shift_name }) }));
  const alertDecisions: Decision[] = (alerts.data ?? []).map((a) => ({
    id: a.id, tone: a.severity === "high" ? "late" : "warn", action: "",
    text: a.source_type === "request_stalled" ? t("data.req.stalled") : String(a.title).startsWith("Request overdue") ? t("data.req.overdue") : t("data.req.due"),
  }));

  return {
    noMembership: false,
    company: { id: co.id, name: co.name, kind: t("data.kind"), logoPath: co.logo_path },
    user: { name: emp.data?.full_name ?? user.email ?? "", role: emp.data?.role_title ?? (ROLE_KEY[m.role] ? t(ROLE_KEY[m.role]) : "") },
    shadowMode: true, // the agent sends nothing yet; becomes a per-company setting in session 7
    counts: { inboxToReview: inbox.count ?? 0, draftsWaiting: drafts.count ?? 0, urgentAlerts: (urgent.count ?? 0) + (alerts.data ?? []).filter((a) => a.severity === "high").length },
    radar: empty.radar, // flights/radar are wired in session 5
    decisions: [...shiftDecisions, ...alertDecisions, ...(triage.data ?? []).map((x) => ({ id: x.id, tone: urgencyTone(x.urgency), text: x.summary ?? t("data.email.new"), action: x.needs_reply ? t("data.email.reviewDraft") : t("data.email.open"), href: `/inbox?id=${x.id}` }))],
    requests: (reqs.data ?? []).map((r) => ({ id: r.id, airline: (r.flight_ref ?? "").slice(0, 2) || "•", title: r.title, status: r.current_stage, tone: r.urgent ? "late" : "info", next: r.next_action ?? "" })),
  };
}
