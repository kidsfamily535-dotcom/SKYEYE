"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { TFn, Lang } from "@/lib/i18n";

type Result = { ok: true } | { ok: false; message: string };
export type ReasonOption = { key: string; label: string; responsibility: string | null; general: boolean };

function explain(msg: string, t: TFn): string {
  if (msg.includes("employee profile required")) return t("fl.err.noEmployee");
  if (msg.includes("not allowed")) return t("fl.err.notAllowed");
  if (msg.includes("future")) return t("fl.err.future");
  if (msg.includes("time is required")) return t("fl.err.timeReq");
  if (msg.includes("reason is required")) return t("fl.err.reasonReq");
  if (msg.includes("rotation is incomplete")) return t("fl.err.incomplete");
  if (msg.includes("already open")) return t("otp.err.already");
  if (msg.includes("body class unknown")) return t("otp.err.body");
  return t("fl.err.generic");
}
const refresh = () => { revalidatePath("/flights"); revalidatePath("/"); };
/** datetime-local values are read as UTC (fixed project rule: times are UTC). */
function utc(v: string): string | null { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null; const d = new Date(v + ":00Z"); return Number.isNaN(+d) ? null : d.toISOString(); }

export async function otpOpenTurn(rotationId: string, inBlock: string): Promise<Result> {
  const { t } = await getT();
  const at = inBlock.trim() ? utc(inBlock) : null;
  if (inBlock.trim() && !at) return { ok: false, message: t("fl.err.timeReq") };
  const { error } = await (await createClient()).rpc("otp_open_turn", { p_rotation_id: rotationId, p_in_block: at });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function otpSetInBlock(turnId: string, at: string): Promise<Result> {
  const { t } = await getT();
  const v = utc(at); if (!v) return { ok: false, message: t("fl.err.timeReq") };
  const { error } = await (await createClient()).rpc("otp_set_in_block", { p_turn: turnId, p_time: v });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function otpRecordEnd(turnId: string, code: string, at: string, note: string): Promise<Result> {
  const { t } = await getT();
  const v = utc(at); if (!v) return { ok: false, message: t("fl.err.timeReq") };
  const { error } = await (await createClient()).rpc("otp_record_end", { p_turn: turnId, p_code: code, p_occurred: v, p_note: note.trim() || null });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function otpRecordStart(turnId: string, code: string, at: string, note: string): Promise<Result> {
  const { t } = await getT();
  const v = utc(at); if (!v) return { ok: false, message: t("fl.err.timeReq") };
  const { error } = await (await createClient()).rpc("otp_record_start", { p_turn: turnId, p_code: code, p_started: v, p_note: note.trim() || null });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function otpStateReason(turnId: string, milestone: string, reasonKey: string): Promise<Result> {
  const { t } = await getT();
  const { error } = await (await createClient()).rpc("otp_state_reason", { p_turn: turnId, p_milestone: milestone, p_reason_key: reasonKey, p_minutes: null, p_note: null });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function otpLoadReasons(turnId: string, milestone: string, lang: Lang): Promise<{ ok: true; reasons: ReasonOption[] } | { ok: false; message: string }> {
  const { t } = await getT();
  const { data, error } = await (await createClient()).rpc("otp_reasons", { p_turn: turnId, p_milestone: milestone, p_lang: lang });
  if (error) return { ok: false, message: explain(error.message, t) };
  return { ok: true, reasons: (data ?? []) as ReasonOption[] };
}
