import { createClient } from "@/lib/supabase/server";

export type AdminCompany = {
  id: string; name: string; code: string | null; created_at: string;
  members: number; active_employees: number;
  emails_total: number; emails_24h: number; last_email_at: string | null;
  emails_by_channel: Record<string, number>;
  direct_mailboxes: number; mailboxes_failing: number;
  gmail_syncs: number; gmail_failing: number;
  open_alerts: number; last_activity_at: string | null;
};
export type AdminMember = {
  membership_id: string; company_id: string; company_name: string; role: string;
  email: string | null; created_at: string;
  employee_id: string | null; full_name: string | null; role_title: string | null; active: boolean | null;
};
export type AdminActivity = { id: string; company_id: string | null; company_name: string | null; action: string; entity_type: string | null; created_at: string };

export type AdminResult =
  | { status: "ok"; companies: AdminCompany[]; members: AdminMember[]; activity: AdminActivity[]; myEmail: string }
  | { status: "denied" }
  | { status: "error" };

/** True only for the platform owner. Never throws: any failure means "not the owner". */
export async function isPlatformAdmin(): Promise<boolean> {
  try {
    const { data } = await (await createClient()).rpc("am_i_platform_admin");
    return data === true;
  } catch { return false; }
}

/** Everything the owner console shows. The database functions refuse anyone who is not the platform owner. */
export async function getAdminData(): Promise<AdminResult> {
  const sb = await createClient();
  const [o, m, a, u] = await Promise.all([
    sb.rpc("admin_overview"), sb.rpc("admin_members"), sb.rpc("admin_recent_activity", { p_limit: 40 }), sb.auth.getUser(),
  ]);
  const denied = [o, m, a].some((r) => r.error?.code === "42501");
  if (denied) return { status: "denied" };
  if (o.error || m.error || a.error) return { status: "error" };
  return {
    status: "ok", myEmail: u.data.user?.email ?? "",
    companies: (o.data ?? []) as AdminCompany[], members: (m.data ?? []) as AdminMember[], activity: (a.data ?? []) as AdminActivity[],
  };
}
