"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { TFn } from "@/lib/i18n";

type Result = { ok: true } | { ok: false; message: string };

function explain(msg: string, t: TFn): string {
  if (msg.includes("employee profile required")) return t("fl.err.noEmployee");
  if (msg.includes("not allowed")) return t("fl.err.notAllowed");
  if (msg.includes("already recorded")) return t("fl.err.stepRecorded");
  if (msg.includes("already answered")) return t("fl.err.answered");
  if (msg.includes("future")) return t("fl.err.future");
  if (msg.includes("actual time is required")) return t("fl.err.timeReq");
  if (msg.includes("unknown step")) return t("fl.err.unknownStep");
  if (msg.includes("rotation is incomplete")) return t("fl.err.incomplete");
  if (msg.includes("reason is required")) return t("fl.err.reasonReq");
  if (msg.includes("negative")) return t("fl.err.negative");
  return t("fl.err.generic");
}
const refresh = () => { revalidatePath("/flights"); revalidatePath("/"); };
/** The form's datetime-local value is read as UTC (fixed rule: times are UTC). */
function utc(v: string): string | null { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null; const d = new Date(v + ":00Z"); return Number.isNaN(+d) ? null : d.toISOString(); }

export async function recordStep(flightId: string, step: string, at: string, note: string): Promise<Result> {
  const { t: tr } = await getT();
  const t = utc(at); if (!t) return { ok: false, message: tr("fl.err.timeReq") };
  const { error } = await (await createClient()).rpc("record_flight_step", { p_flight_id: flightId, p_step_code: step, p_occurred_at: t, p_note: note.trim() || null });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh(); return { ok: true };
}

export async function answerCheckin(checkinId: string, answer: "yes" | "not_yet" | "not_applicable", at: string, note: string): Promise<Result> {
  const { t: tr } = await getT();
  let t: string | null = null;
  if (answer === "yes") { t = utc(at); if (!t) return { ok: false, message: tr("fl.err.timeReq") }; }
  const { error } = await (await createClient()).rpc("answer_turnaround_checkin", { p_checkin_id: checkinId, p_answer: answer, p_actual_time: t, p_note: note.trim() || null });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh(); return { ok: true };
}

export async function stateDelay(flightId: string, step: string, codeId: string, minutes: string, reason: string): Promise<Result> {
  const { t: tr } = await getT();
  const m = minutes.trim() === "" ? null : Number(minutes);
  if (m !== null && (!Number.isInteger(m) || m < 0)) return { ok: false, message: tr("fl.err.minutesInt") };
  const { error } = await (await createClient()).rpc("state_flight_delay", { p_flight_id: flightId, p_step_code: step || null, p_delay_code_id: codeId || null, p_delay_minutes: m, p_reason_text: reason });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh(); return { ok: true };
}

export async function correctStep(eventId: string, at: string, reason: string): Promise<Result> {
  const { t: tr } = await getT();
  const t = utc(at); if (!t) return { ok: false, message: tr("fl.err.correctTime") };
  if (reason.trim().length < 3) return { ok: false, message: tr("fl.err.correctWhy") };
  const { error } = await (await createClient()).rpc("correct_flight_step", { p_event_id: eventId, p_new_time: t, p_reason: reason.trim() });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh(); return { ok: true };
}

export type Composed =
  | { status: "ok"; draftId: string; draft: string; warnings: string[]; deviations: string[] }
  | { status: "missing"; missing: { field: string; label: string; format: string }[] }
  | { status: "error"; message: string };

/** Builds a message DRAFT only (saved in message_drafts). Nothing is sent: the employee edits it, copies it and sends it from the company mailbox.
 *  Values that look like JSON ({...} or [...]) are sent as JSON (delay codes, destinations, positions...). */
export async function composeFlightMessage(companyId: string, type: string, flightId: string, data: Record<string, string>): Promise<Composed> {
  const { t: tr } = await getT();
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const s = v.trim(); if (!s) continue;
    if (/^[\[{]/.test(s)) { try { clean[k] = JSON.parse(s); } catch { return { status: "error", message: tr("fl.err.json", { field: k }) }; } } else clean[k] = s;
  }
  const { data: r, error } = await (await createClient()).rpc("compose_message", { p_company_id: companyId, p_type: type, p_data: { ...clean, flight_id: flightId } });
  if (error) return { status: "error", message: explain(error.message, tr) };
  const o = r as Record<string, any>;
  if (o.status === "ok") { refresh(); return { status: "ok", draftId: String(o.draft_id ?? ""), draft: String(o.draft ?? ""), warnings: (o.warnings ?? []).map(String), deviations: (o.deviations ?? []).map((d: unknown) => typeof d === "string" ? d : JSON.stringify(d)) }; }
  if (o.status === "missing") return { status: "missing", missing: o.missing ?? [] };
  if (o.status === "invalid" && Array.isArray(o.invalid) && o.invalid.length) return { status: "error", message: o.invalid.map((d: unknown) => typeof d === "string" ? d : JSON.stringify(d)).join(" · ") };
  if (o.status === "unsupported") return { status: "error", message: tr("fl.err.unsupported", { reason: typeof o.reason === "string" ? ` (${o.reason})` : "" }) };
  return { status: "error", message: typeof o.note === "string" ? o.note : tr("fl.err.compose") };
}

export type SaveResult = { ok: true; deviations: string[]; warnings: string[] } | { ok: false; message: string };

/** Saves the employee's edit of a draft; the database re-checks it against the GOM format and records before/after. */
export async function saveMessageDraft(draftId: string, body: string): Promise<SaveResult> {
  const { t: tr } = await getT();
  const { data, error } = await (await createClient()).rpc("save_message_draft_edit", { p_draft_id: draftId, p_body: body });
  if (error) return { ok: false, message: explain(error.message, tr) };
  const o = data as Record<string, any>;
  if (o.status === "closed") return { ok: false, message: tr("fl.err.draftClosed") };
  if (o.status === "invalid") return { ok: false, message: tr("fl.err.emptyBody") };
  refresh();
  return { ok: true, deviations: (o.deviations ?? []).map(String), warnings: (o.warnings ?? []).map(String) };
}

/** Records that the employee sent the drafted message from the company mailbox. The system sends nothing. */
export async function markMessageSent(draftId: string): Promise<Result> {
  const { t: tr } = await getT();
  const { error } = await (await createClient()).rpc("mark_message_sent", { p_draft_id: draftId });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh(); return { ok: true };
}
export async function rejectMessageDraft(draftId: string): Promise<Result> {
  const { t: tr } = await getT();
  const { error } = await (await createClient()).rpc("review_message_draft", { p_draft_id: draftId, p_decision: "rejected" });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh(); return { ok: true };
}

export type Opened =
  | { status: "ready"; draftId: string; body: string; warnings: string[]; existing: boolean }
  | { status: "missing"; missing: { field: string; label: string; format: string }[] }
  | { status: "error"; message: string };

/** Opens the draft of one movement message from the flight card. Reuses the open draft if there is one; otherwise the database builds it from what the agent knows
 *  and names exactly what is missing (it never guesses). Nothing is sent. Values that look like JSON ({...} or [...]) are sent as JSON. */
export async function openMessageDraft(companyId: string, flightId: string, type: string, values: Record<string, string>): Promise<Opened> {
  const { t: tr } = await getT();
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    const s = v.trim(); if (!s) continue;
    if (/^[\[{]/.test(s)) { try { clean[k] = JSON.parse(s); } catch { return { status: "error", message: tr("fl.err.json", { field: k }) }; } } else clean[k] = s;
  }
  const { data: r, error } = await (await createClient()).rpc("open_message_draft", { p_company_id: companyId, p_flight_id: flightId, p_type: type, p_values: clean });
  if (error) return { status: "error", message: explain(error.message, tr) };
  const o = (r ?? {}) as Record<string, any>;
  if (o.status === "exists" && o.draft) return { status: "ready", draftId: String(o.draft.id), body: String(o.draft.body_text ?? ""), warnings: (o.draft.warnings ?? []).map(String), existing: true };
  if (o.status === "ok") { refresh(); return { status: "ready", draftId: String(o.draft_id ?? ""), body: String(o.draft ?? ""), warnings: (o.warnings ?? []).map(String), existing: false }; }
  if (o.status === "missing") return { status: "missing", missing: o.missing ?? [] };
  if (o.status === "invalid" && Array.isArray(o.invalid) && o.invalid.length) return { status: "error", message: o.invalid.map((d: unknown) => typeof d === "string" ? d : JSON.stringify(d)).join(" · ") };
  if (o.status === "unsupported") return { status: "error", message: tr("fl.err.unsupported", { reason: typeof o.reason === "string" ? ` (${o.reason})` : "" }) };
  if (o.status === "not_found") return { status: "error", message: tr("fl.notFound") };
  return { status: "error", message: typeof o.note === "string" ? o.note : tr("fl.err.compose") };
}

/** The employee confirms or rejects the type SKYEYE suggested for a flight (confirm applies it to both legs of the rotation). */
export async function decideFlightType(suggestionId: string, decision: "confirm" | "reject"): Promise<Result> {
  const { t: tr } = await getT();
  const { error } = await (await createClient()).rpc("decide_flight_type_suggestion", { p_id: suggestionId, p_decision: decision });
  if (error) return { ok: false, message: explain(error.message, tr) };
  refresh();
  return { ok: true };
}
