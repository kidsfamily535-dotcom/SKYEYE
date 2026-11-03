import { createClient } from "@/lib/supabase/server";

export type AlertLevel = "L1" | "L2" | "L3" | "L4";
export type AlertState = "open" | "acknowledged" | "snoozed" | "resolved";
export type AlertLogItem = { id: string; event: string; at: string; actor: string | null; details: Record<string, unknown> };
export type FlightAlert = {
  id: string; companyId: string; flightId: string | null; flightNumber: string | null;
  level: AlertLevel; state: AlertState; ruleCode: string | null; ruleNameAr: string | null;
  reasonAr: string; actionAr: string | null; dueAt: string | null; createdAt: string;
  acknowledgedAt: string | null; snoozedUntil: string | null; snoozeReason: string | null;
  resolvedAt: string | null; resolutionNote: string | null; log: AlertLogItem[];
};
export type AlertsData = { active: FlightAlert[]; recent: FlightAlert[]; canWrite: boolean };

const LEVELS: AlertLevel[] = ["L1", "L2", "L3", "L4"];
const rank = (l: string) => LEVELS.indexOf(l as AlertLevel);
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

type Row = {
  id: string; company_id: string; flight_id: string | null; level: string; state: string; reason_ar: string | null; action_ar: string | null;
  due_at: string | null; created_at: string; acknowledged_at: string | null; snoozed_until: string | null; snooze_reason: string | null;
  resolved_at: string | null; resolution_note: string | null;
  flight_alert_rules: { rule_code: string | null; name_ar: string | null } | { rule_code: string | null; name_ar: string | null }[] | null;
};

/** Alerts of the signed-in user's company (RLS scopes the rows). Active = not resolved. Most severe first, then the oldest due. */
export async function getAlerts(): Promise<AlertsData> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { active: [], recent: [], canWrite: false };
  const cols = "id, company_id, flight_id, level, state, reason_ar, action_ar, due_at, created_at, acknowledged_at, snoozed_until, snooze_reason, resolved_at, resolution_note, flight_alert_rules(rule_code, name_ar)";
  const [act, rec, mem] = await Promise.all([
    sb.from("flight_alerts").select(cols).neq("state", "resolved").limit(100),
    sb.from("flight_alerts").select(cols).eq("state", "resolved").order("resolved_at", { ascending: false }).limit(10),
    sb.from("memberships").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  const rows = [...((act.data ?? []) as unknown as Row[]), ...((rec.data ?? []) as unknown as Row[])];
  if (rows.length === 0) return { active: [], recent: [], canWrite: !!mem.data && mem.data.role !== "viewer" };

  const flightIds = [...new Set(rows.map((r) => r.flight_id).filter((x): x is string => !!x))];
  const alertIds = rows.map((r) => r.id);
  const [fl, lg] = await Promise.all([
    flightIds.length ? sb.from("flights").select("id, flight_number").in("id", flightIds) : Promise.resolve({ data: [] as { id: string; flight_number: string | null }[] }),
    sb.from("flight_alert_log").select("id, alert_id, event, occurred_at, actor_label, details").in("alert_id", alertIds).order("occurred_at", { ascending: true }),
  ]);
  const fnum = new Map((fl.data ?? []).map((f) => [f.id, f.flight_number]));
  const logs = new Map<string, AlertLogItem[]>();
  for (const l of (lg.data ?? []) as { id: string; alert_id: string; event: string; occurred_at: string; actor_label: string | null; details: unknown }[]) {
    const item: AlertLogItem = { id: l.id, event: l.event, at: l.occurred_at, actor: l.actor_label, details: (l.details && typeof l.details === "object" ? l.details : {}) as Record<string, unknown> };
    logs.set(l.alert_id, [...(logs.get(l.alert_id) ?? []), item]);
  }

  const map = (r: Row): FlightAlert => {
    const rule = Array.isArray(r.flight_alert_rules) ? r.flight_alert_rules[0] : r.flight_alert_rules;
    return {
      id: r.id, companyId: r.company_id, flightId: r.flight_id, flightNumber: r.flight_id ? (fnum.get(r.flight_id) ?? null) : null,
      level: (LEVELS.includes(r.level as AlertLevel) ? r.level : "L2") as AlertLevel, state: r.state as AlertState,
      ruleCode: rule?.rule_code ?? null, ruleNameAr: rule?.name_ar ?? null, reasonAr: r.reason_ar ?? "", actionAr: r.action_ar,
      dueAt: r.due_at, createdAt: r.created_at, acknowledgedAt: r.acknowledged_at, snoozedUntil: r.snoozed_until, snoozeReason: r.snooze_reason,
      resolvedAt: r.resolved_at, resolutionNote: r.resolution_note, log: logs.get(r.id) ?? [],
    };
  };
  const active = ((act.data ?? []) as unknown as Row[]).map(map).sort((a, b) => rank(b.level) - rank(a.level) || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  const recent = ((rec.data ?? []) as unknown as Row[]).map(map);
  return { active, recent, canWrite: !!mem.data && mem.data.role !== "viewer" };
}

/** Alerts that still need a person: open or acknowledged (a snoozed one is waiting for its time). */
export const needsAttention = (a: FlightAlert) => a.state === "open" || a.state === "acknowledged";
