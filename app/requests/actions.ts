"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

type Result = { ok: true; id?: string } | { ok: false; message: string };

async function explain(msg: string): Promise<string> {
  const { t } = await getT();
  const k: Key = msg.includes("not allowed") ? "req.err.notAllowed"
    : msg.includes("transition") ? "req.err.transition"
    : msg.includes("reason is required") ? "req.err.reason"
    : msg.includes("evidence") ? "req.err.evidence"
    : msg.includes("already") ? "req.err.already" : "sh.err.generic";
  return t(k);
}
const refresh = () => { revalidatePath("/requests"); revalidatePath("/inbox"); revalidatePath("/"); };

export async function advanceRequest(fileId: string, toStage: string, note: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("advance_request_stage", { p_file_id: fileId, p_to_stage: toStage, p_note: note.trim() });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh(); return { ok: true };
}

export async function setAlertStatus(companyId: string, alertId: string, status: "acknowledged" | "dismissed"): Promise<Result> {
  const { error } = await (await createClient()).rpc("set_exception_status", { p_company_id: companyId, p_exception_id: alertId, p_status: status });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh(); return { ok: true };
}

export async function openRequestFromEmail(input: { triageId: string; title: string; flightRef: string; flightDate: string; dueAt: string; urgent: boolean; requestType?: "permit" | "complaint" }): Promise<Result> {
  const title = input.title.trim();
  if (!title || title.length > 160) return { ok: false, message: (await getT()).t("req.err.title") };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.flightDate) ? input.flightDate : null;
  let due: string | null = null;
  if (input.dueAt) { const d = new Date(input.dueAt + "Z"); if (Number.isNaN(+d)) return { ok: false, message: (await getT()).t("req.err.due") }; due = d.toISOString(); }
  const { data, error } = await (await createClient()).rpc("open_request_file", {
    p_triage_id: input.triageId, p_request_type: input.requestType === "complaint" ? "complaint" : "permit", p_title: title, p_flight_ref: input.flightRef.trim().toUpperCase() || null,
    p_flight_date: date, p_due_at: due, p_urgent: input.urgent,
  });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh(); return { ok: true, id: data as string };
}

export async function linkEmailToRequest(companyId: string, fileId: string, messageId: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("link_request_message", { p_company_id: companyId, p_request_file_id: fileId, p_message_id: messageId, p_link_method: "manual", p_link_status: "confirmed" });
  if (error) return { ok: false, message: await explain(error.message) };
  refresh(); return { ok: true };
}
