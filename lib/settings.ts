import { createClient } from "@/lib/supabase/server";
import type { Res } from "@/lib/admin";

export type Member = { membership_id: string; role: string; email: string | null; full_name: string | null; role_title: string | null; me: boolean };
export type Invite = { id: string; email: string; full_name: string; role: string; created_at: string; expires_at: string };
export const TEAM_ROLES = ["admin", "operator", "viewer"] as const;

/** Company team for the company's own admin. The database function refuses anyone who is not owner/admin of an active company. */
export async function getTeam(): Promise<Res<Member[]>> {
  try {
    const { data, error } = await (await createClient()).rpc("company_team");
    if (error) return { status: error.code === "42501" ? "denied" : "error" };
    return { status: "ok", data: (data ?? []) as Member[] };
  } catch { return { status: "error" }; }
}

export type Profile = { name: string; code: string | null; country: string | null; types: string[]; plan: string | null; status: string | null; renews_on: string | null };
export async function getProfile(companyId: string): Promise<Profile | null> {
  try {
    const sb = await createClient();
    const [c, s] = await Promise.all([
      sb.from("companies").select("name, code, country, business_types").eq("id", companyId).maybeSingle(),
      sb.from("company_subscriptions").select("plan_code, status, renews_on").eq("company_id", companyId).maybeSingle(),
    ]);
    if (!c.data) return null;
    return { name: c.data.name, code: c.data.code, country: c.data.country, types: (c.data.business_types ?? []) as string[], plan: s.data?.plan_code ?? null, status: s.data?.status ?? null, renews_on: s.data?.renews_on ?? null };
  } catch { return null; }
}

export const POLICY_TABLES = ["flight_alert_rules", "request_policies", "escalation_policies"] as const;
export type PolicyTable = (typeof POLICY_TABLES)[number];
export type PolicyRow = { table: PolicyTable; id: string; title: string; minutes: number | null; hours: number | null; extra: string };

/** Draft policies of the caller's own company, waiting for the admin's approval. Nothing is guessed: empty numbers stay empty. */
export async function getDraftPolicies(companyId: string): Promise<{ rows: PolicyRow[]; approved: Record<PolicyTable, number> }> {
  const out: PolicyRow[] = []; const approved = { flight_alert_rules: 0, request_policies: 0, escalation_policies: 0 } as Record<PolicyTable, number>;
  try {
    const sb = await createClient();
    const [a, r, e] = await Promise.all([
      sb.from("flight_alert_rules").select("id, rule_code, name_ar, threshold_minutes, base_level, status").eq("company_id", companyId),
      sb.from("request_policies").select("id, request_type, policy_kind, stage_code, hours, status").eq("company_id", companyId),
      sb.from("escalation_policies").select("id, from_level, ack_minutes, escalate_to_level, escalate_to_role, status").eq("company_id", companyId),
    ]);
    for (const x of a.data ?? []) { if (x.status === "approved") approved.flight_alert_rules++; else if (x.status === "draft") out.push({ table: "flight_alert_rules", id: x.id, title: x.name_ar || x.rule_code, minutes: x.threshold_minutes ?? null, hours: null, extra: x.base_level ?? "" }); }
    for (const x of r.data ?? []) { if (x.status === "approved") approved.request_policies++; else if (x.status === "draft") out.push({ table: "request_policies", id: x.id, title: [x.request_type, x.policy_kind, x.stage_code].filter(Boolean).join(" · "), minutes: null, hours: x.hours ?? null, extra: "" }); }
    for (const x of e.data ?? []) { if (x.status === "approved") approved.escalation_policies++; else if (x.status === "draft") out.push({ table: "escalation_policies", id: x.id, title: `${x.from_level} → ${x.escalate_to_level ?? "—"}`, minutes: x.ack_minutes ?? null, hours: null, extra: x.escalate_to_role ?? "" }); }
  } catch { /* empty list */ }
  return { rows: out, approved };
}

/** Pending invitations of the caller's own company. The database function refuses anyone who is not owner/admin. */
export async function getInvites(): Promise<Invite[]> {
  try {
    const { data, error } = await (await createClient()).rpc("company_pending_invites");
    return error ? [] : ((data ?? []) as Invite[]);
  } catch { return []; }
}
