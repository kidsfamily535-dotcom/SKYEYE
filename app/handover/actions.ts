"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

type Result = { ok: true; took?: number } | { ok: false; message: string };

async function explain(msg: string): Promise<string> {
  const { t } = await getT();
  const k: Key = msg.includes("employee profile required") ? "sh.err.noEmployee"
    : msg.includes("already acknowledged") ? "sh.err.already"
    : msg.includes("HH:MM") ? "sh.err.hhmm"
    : msg.includes("duration") ? "sh.err.duration"
    : msg.includes("name is required") ? "sh.err.name"
    : msg.includes("not allowed") ? "sh.err.notAllowed" : "sh.err.generic";
  return t(k);
}
const refresh = () => { revalidatePath("/handover"); revalidatePath("/requests"); revalidatePath("/"); };

export async function acknowledgeShift(reportId: string, note: string, takeRequests: boolean): Promise<Result> {
  const { data, error } = await (await createClient()).rpc("acknowledge_shift_report", { p_report_id: reportId, p_note: note.trim() || null, p_take_requests: takeRequests });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh();
  return { ok: true, took: Number((data as { took_requests?: number } | null)?.took_requests ?? 0) };
}

export async function saveShiftDefinition(companyId: string, name: string, startHhmm: string, durationHours: number, active: boolean): Promise<Result> {
  if (!Number.isFinite(durationHours)) return { ok: false, message: (await getT()).t("sh.err.hours") };
  const { error } = await (await createClient()).rpc("set_shift_definition", { p_company_id: companyId, p_name: name, p_start_hhmm: startHhmm.trim(), p_duration_minutes: Math.round(durationHours * 60), p_active: active });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh();
  return { ok: true };
}
