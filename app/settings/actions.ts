"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { POLICY_TABLES, TEAM_ROLES } from "@/lib/settings";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
function done(ok: boolean, okFlag = ""): never { revalidatePath("/settings"); redirect(ok ? (okFlag ? `/settings?${okFlag}` : "/settings") : "/settings?err=1"); }

/** The database function checks that the caller is admin of this very company and refuses self-changes. */
export async function setRole(f: FormData): Promise<void> {
  const id = s(f, "id"); const role = s(f, "role");
  if (!UUID.test(id) || !(TEAM_ROLES as readonly string[]).includes(role)) done(false);
  const { error } = await (await createClient()).rpc("company_set_member_role", { p_membership: id, p_role: role });
  done(!error);
}
export async function removeMember(f: FormData): Promise<void> {
  const id = s(f, "id"); if (!UUID.test(id)) done(false);
  const { error } = await (await createClient()).rpc("company_remove_member", { p_membership: id });
  done(!error);
}
/** Approval goes through row-level security: only an admin of the company may set a policy to approved. */
export async function approvePolicy(f: FormData): Promise<void> {
  const id = s(f, "id"); const table = s(f, "table");
  if (!UUID.test(id) || !(POLICY_TABLES as readonly string[]).includes(table)) done(false);
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser(); if (!user) redirect("/login");
  const { data, error } = await sb.from(table).update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("id");
  done(!error && (data?.length ?? 0) > 0);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Records a pending invitation. The database function checks the caller is admin of this company and links the person when they sign up with this email. */
export async function inviteMember(f: FormData): Promise<void> {
  const email = s(f, "email").toLowerCase(); const name = s(f, "name"); const role = s(f, "role");
  if (!EMAIL.test(email) || email.length > 254 || name.length < 1 || name.length > 120 || !(TEAM_ROLES as readonly string[]).includes(role)) done(false);
  const { error } = await (await createClient()).rpc("company_invite_member", { p_email: email, p_full_name: name, p_role: role });
  done(!error, "inv=1");
}
export async function cancelInvite(f: FormData): Promise<void> {
  const id = s(f, "id"); if (!UUID.test(id)) done(false);
  const { error } = await (await createClient()).rpc("company_cancel_invite", { p_invite: id });
  done(!error);
}
