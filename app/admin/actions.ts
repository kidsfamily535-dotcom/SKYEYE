"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Suspends or re-activates an employee. The database function checks that the caller is the platform owner and logs the change. */
export async function setEmployeeActive(formData: FormData): Promise<void> {
  const id = String(formData.get("employee_id") ?? "");
  const active = formData.get("active") === "true";
  if (!UUID.test(id)) redirect("/admin?tab=people&err=1");
  const { error } = await (await createClient()).rpc("admin_set_employee_active", { p_employee_id: id, p_active: active });
  if (error) redirect("/admin?tab=people&err=1");
  revalidatePath("/admin");
  redirect("/admin?tab=people");
}
