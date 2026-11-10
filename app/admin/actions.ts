"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_TYPES, MODULES, ROLES, STATUSES } from "@/lib/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const one = <T extends string>(v: string, list: readonly T[]): v is T => (list as readonly string[]).includes(v);

/** Runs an owner-only database function. The function itself refuses anyone who is not the platform owner and logs the change. */
async function run(fn: string, args: Record<string, unknown>): Promise<boolean> {
  const { error } = await (await createClient()).rpc(fn, args);
  return !error;
}
function back(id: string, ok: boolean, extra = ""): never {
  revalidatePath(`/admin/${id}`); revalidatePath("/admin");
  redirect(`/admin/${id}?${ok ? "" : "err=1&"}${extra}`);
}

export async function createCompany(f: FormData): Promise<void> {
  const type = s(f, "type"); const plan = s(f, "plan");
  if (!one(type, COMPANY_TYPES) || !plan) redirect("/admin/new?err=1");
  const { data, error } = await (await createClient()).rpc("admin_create_company", {
    p_name: s(f, "name"), p_code: s(f, "code"), p_country: s(f, "country"), p_business_types: [type], p_plan: plan,
  });
  if (error || typeof data !== "string") redirect("/admin/new?err=1");
  revalidatePath("/admin");
  redirect(`/admin/${data}`);
}

export async function setPlan(f: FormData): Promise<void> {
  const id = s(f, "id"); if (!UUID.test(id)) redirect("/admin");
  back(id, await run("admin_set_company_plan", { p_company: id, p_plan: s(f, "plan") }));
}
export async function setStatus(f: FormData): Promise<void> {
  const id = s(f, "id"); const st = s(f, "status"); if (!UUID.test(id)) redirect("/admin");
  if (!one(st, STATUSES)) back(id, false);
  const d = s(f, "renews_on");
  back(id, await run("admin_set_company_status", { p_company: id, p_status: st, p_renews_on: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null }));
}
export async function setModule(f: FormData): Promise<void> {
  const id = s(f, "id"); const m = s(f, "module"); if (!UUID.test(id)) redirect("/admin");
  if (!one(m, MODULES)) back(id, false);
  back(id, await run("admin_set_company_module", { p_company: id, p_module: m, p_enabled: s(f, "enabled") === "true" }));
}
export async function addAirline(f: FormData): Promise<void> {
  const id = s(f, "id"); const a = s(f, "airline"); if (!UUID.test(id)) redirect("/admin");
  back(id, UUID.test(a) && await run("admin_add_company_airline", { p_company: id, p_airline: a }));
}
export async function removeAirline(f: FormData): Promise<void> {
  const id = s(f, "id"); const a = s(f, "airline"); if (!UUID.test(id)) redirect("/admin");
  back(id, UUID.test(a) && await run("admin_remove_company_airline", { p_company: id, p_airline: a }));
}
export async function addMember(f: FormData): Promise<void> {
  const id = s(f, "id"); const role = s(f, "role"); if (!UUID.test(id)) redirect("/admin");
  back(id, one(role, ROLES) && await run("admin_add_member", { p_company: id, p_email: s(f, "email"), p_role: role }));
}

export async function setBilling(f: FormData): Promise<void> {
  const id = s(f, "id"); const cycle = s(f, "cycle"); const d = s(f, "started_on"); if (!UUID.test(id)) redirect("/admin");
  const ok = (cycle === "monthly" || cycle === "yearly") && /^\d{4}-\d{2}-\d{2}$/.test(d);
  back(id, ok && await run("admin_set_company_billing", { p_company: id, p_cycle: cycle, p_started_on: d, p_amount_note: s(f, "amount_note") }));
}
export async function renewCompany(f: FormData): Promise<void> {
  const id = s(f, "id"); if (!UUID.test(id)) redirect("/admin");
  back(id, await run("admin_renew_company", { p_company: id }));
}
