"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function companyOf() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: m } = await sb.from("memberships").select("company_id").eq("user_id", user.id).maybeSingle();
  return m ? { sb, company: m.company_id as string } : null;
}

/** A note is a new line in the file. It can never edit or remove an earlier line (the database refuses). */
export async function addLibraryNote(fd: FormData): Promise<void> {
  const id = String(fd.get("file") ?? ""); const text = String(fd.get("text") ?? "").trim();
  if (!UUID.test(id) || !text) return;
  const c = await companyOf(); if (!c) return;
  await c.sb.rpc("library_add_note", { p_company: c.company, p_file_id: id, p_text: text.slice(0, 2000), p_type: "note" });
  revalidatePath("/");
}

export async function setLibraryStatus(fd: FormData): Promise<void> {
  const id = String(fd.get("file") ?? ""); const to = String(fd.get("to") ?? "");
  if (!UUID.test(id) || (to !== "open" && to !== "closed")) return;
  const c = await companyOf(); if (!c) return;
  await c.sb.rpc("library_set_status", { p_company: c.company, p_file_id: id, p_status: to });
  revalidatePath("/");
}
