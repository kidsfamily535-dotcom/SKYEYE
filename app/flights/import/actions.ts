"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseProgram, type ProgramResult } from "@/lib/program";
import { getT } from "@/lib/lang";
import type { TFn } from "@/lib/i18n";

export type ImportOut = { ok: true; data: ProgramResult } | { ok: false; message: string };

function explain(msg: string, t: TFn): string {
  if (msg.includes("not allowed to add")) return t("imp.e.adminOnly");
  if (msg.includes("not allowed")) return t("imp.e.notAllowed");
  if (msg.includes("too many rows")) return t("imp.e.tooMany");
  if (msg.includes("no rows")) return t("imp.e.noRows");
  return t("fl.err.generic");
}

async function run(text: string, commit: boolean, addMissing: boolean): Promise<ImportOut> {
  const { t } = await getT();
  const p = parseProgram(text, t);
  if (!p.ok) return { ok: false, message: p.message };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: t("imp.e.session") };
  const { data: m } = await sb.from("memberships").select("company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return { ok: false, message: t("imp.e.noCompany") };
  const { data, error } = await sb.rpc("submit_flight_program", { p_company_id: m.company_id, p_rows: p.rows, p_commit: commit, p_add_missing: addMissing });
  if (error) return { ok: false, message: explain(error.message, t) };
  if (commit) { revalidatePath("/flights"); revalidatePath("/"); }
  return { ok: true, data: data as ProgramResult };
}

/** Checks the pasted program without saving anything. */
export async function previewProgram(text: string): Promise<ImportOut> { return run(text, false, false); }
/** Saves it only if every row is valid. The database re-checks everything. */
export async function commitProgram(text: string, addMissing: boolean): Promise<ImportOut> { return run(text, true, addMissing); }
