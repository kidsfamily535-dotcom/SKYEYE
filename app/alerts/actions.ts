"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

type Result = { ok: true } | { ok: false; message: string };

async function explain(msg: string): Promise<string> {
  const { t } = await getT();
  const k: Key = msg.includes("employee profile required") ? "fa.err.noEmployee"
    : msg.includes("already resolved") ? "fa.err.resolved"
    : msg.includes("resolution note required") ? "fa.err.note"
    : msg.includes("snooze reason required") ? "fa.err.reason"
    : msg.includes("between 5 and 120") ? "fa.err.minutes"
    : msg.includes("critical alerts cannot be snoozed") ? "fa.err.critical"
    : msg.includes("alert not found") ? "fa.err.notFound"
    : msg.includes("not allowed") ? "fa.err.notAllowed" : "fa.err.generic";
  return t(k);
}
const refresh = () => { revalidatePath("/alerts"); revalidatePath("/"); revalidatePath("/flights"); };

export async function acknowledgeAlert(companyId: string, alertId: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("acknowledge_flight_alert", { p_company_id: companyId, p_alert_id: alertId });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh();
  return { ok: true };
}

export async function snoozeAlert(companyId: string, alertId: string, minutes: number, reason: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("snooze_flight_alert", { p_company_id: companyId, p_alert_id: alertId, p_minutes: minutes, p_reason: reason.trim() });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh();
  return { ok: true };
}

export async function resolveAlert(companyId: string, alertId: string, note: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("resolve_flight_alert", { p_company_id: companyId, p_alert_id: alertId, p_note: note.trim() });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh();
  return { ok: true };
}
