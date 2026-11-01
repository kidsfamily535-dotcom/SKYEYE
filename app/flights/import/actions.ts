"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseProgram, type ProgramResult } from "@/lib/program";

export type ImportOut = { ok: true; data: ProgramResult } | { ok: false; message: string };

function explain(msg: string): string {
  if (msg.includes("not allowed to add")) return "إضافة شركات الطيران والمحطات للمدير فقط.";
  if (msg.includes("not allowed")) return "ليست لديك صلاحية رفع برنامج الرحلات لهذه الشركة.";
  if (msg.includes("too many rows")) return "الحد الأقصى 500 سطر في المرة الواحدة.";
  if (msg.includes("no rows")) return "لا توجد أسطر في البرنامج.";
  return "تعذّر تنفيذ الطلب. حاول مرة أخرى.";
}

async function run(text: string, commit: boolean, addMissing: boolean): Promise<ImportOut> {
  const p = parseProgram(text);
  if (!p.ok) return { ok: false, message: p.message };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "انتهت الجلسة. سجّل الدخول من جديد." };
  const { data: m } = await sb.from("memberships").select("company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return { ok: false, message: "حسابك غير مرتبط بشركة." };
  const { data, error } = await sb.rpc("submit_flight_program", { p_company_id: m.company_id, p_rows: p.rows, p_commit: commit, p_add_missing: addMissing });
  if (error) return { ok: false, message: explain(error.message) };
  if (commit) { revalidatePath("/flights"); revalidatePath("/"); }
  return { ok: true, data: data as ProgramResult };
}

/** Checks the pasted program without saving anything. */
export async function previewProgram(text: string): Promise<ImportOut> { return run(text, false, false); }
/** Saves it only if every row is valid. The database re-checks everything. */
export async function commitProgram(text: string, addMissing: boolean): Promise<ImportOut> { return run(text, true, addMissing); }
