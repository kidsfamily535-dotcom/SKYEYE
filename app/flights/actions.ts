"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

function explain(msg: string): string {
  if (msg.includes("employee profile required")) return "حسابك غير مربوط بملف موظف. اطلب من المدير إضافته أولاً.";
  if (msg.includes("not allowed")) return "ليست لديك صلاحية الكتابة في هذه الشركة.";
  if (msg.includes("already recorded")) return "هذه المرحلة مسجّلة من قبل. استخدم «صحّح» لتعديل وقتها.";
  if (msg.includes("already answered")) return "هذا السؤال أُجيب عنه من قبل.";
  if (msg.includes("future")) return "الوقت في المستقبل. اكتب الوقت الفعلي الذي حدث.";
  if (msg.includes("actual time is required")) return "اكتب الوقت الفعلي (UTC).";
  if (msg.includes("unknown step")) return "مرحلة غير معروفة.";
  if (msg.includes("rotation is incomplete")) return "الرحلة بلا ساقَي وصول ومغادرة، فلا يمكن تسجيل مرحلة عليها.";
  if (msg.includes("reason is required")) return "اكتب سبب التأخير بكلماتك (3 أحرف على الأقل).";
  if (msg.includes("negative")) return "الدقائق لا تكون سالبة.";
  return "تعذّر تنفيذ الطلب. حاول مرة أخرى.";
}
const refresh = () => { revalidatePath("/flights"); revalidatePath("/"); };
/** The form's datetime-local value is read as UTC (fixed rule: times are UTC). */
function utc(v: string): string | null { if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null; const d = new Date(v + ":00Z"); return Number.isNaN(+d) ? null : d.toISOString(); }

export async function recordStep(flightId: string, step: string, at: string, note: string): Promise<Result> {
  const t = utc(at); if (!t) return { ok: false, message: "اكتب الوقت الفعلي (UTC)." };
  const { error } = await (await createClient()).rpc("record_flight_step", { p_flight_id: flightId, p_step_code: step, p_occurred_at: t, p_note: note.trim() || null });
  if (error) return { ok: false, message: explain(error.message) };
  refresh(); return { ok: true };
}

export async function answerCheckin(checkinId: string, answer: "yes" | "not_yet" | "not_applicable", at: string, note: string): Promise<Result> {
  let t: string | null = null;
  if (answer === "yes") { t = utc(at); if (!t) return { ok: false, message: "اكتب الوقت الفعلي (UTC)." }; }
  const { error } = await (await createClient()).rpc("answer_turnaround_checkin", { p_checkin_id: checkinId, p_answer: answer, p_actual_time: t, p_note: note.trim() || null });
  if (error) return { ok: false, message: explain(error.message) };
  refresh(); return { ok: true };
}

export async function stateDelay(flightId: string, step: string, codeId: string, minutes: string, reason: string): Promise<Result> {
  const m = minutes.trim() === "" ? null : Number(minutes);
  if (m !== null && (!Number.isInteger(m) || m < 0)) return { ok: false, message: "الدقائق رقم صحيح لا يقل عن صفر." };
  const { error } = await (await createClient()).rpc("state_flight_delay", { p_flight_id: flightId, p_step_code: step || null, p_delay_code_id: codeId || null, p_delay_minutes: m, p_reason_text: reason });
  if (error) return { ok: false, message: explain(error.message) };
  refresh(); return { ok: true };
}

export async function correctStep(eventId: string, at: string, reason: string): Promise<Result> {
  const t = utc(at); if (!t) return { ok: false, message: "اكتب الوقت الصحيح (UTC)." };
  if (reason.trim().length < 3) return { ok: false, message: "اكتب سبب التصحيح." };
  const { error } = await (await createClient()).rpc("correct_flight_step", { p_event_id: eventId, p_new_time: t, p_reason: reason.trim() });
  if (error) return { ok: false, message: explain(error.message) };
  refresh(); return { ok: true };
}

export type Composed =
  | { status: "ok"; draft: string; warnings: string[]; deviations: string[] }
  | { status: "missing"; missing: { field: string; label: string; format: string }[] }
  | { status: "error"; message: string };

/** Builds a message DRAFT only. Nothing is sent: the employee copies it and sends it from the company mailbox. */
export async function composeFlightMessage(companyId: string, type: string, flightId: string, data: Record<string, string>): Promise<Composed> {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (v.trim()) clean[k] = v.trim();
  const { data: r, error } = await (await createClient()).rpc("compose_message", { p_company_id: companyId, p_type: type, p_data: { ...clean, flight_id: flightId } });
  if (error) return { status: "error", message: explain(error.message) };
  const o = r as Record<string, any>;
  if (o.status === "ok") return { status: "ok", draft: String(o.draft ?? ""), warnings: (o.warnings ?? []).map(String), deviations: (o.deviations ?? []).map((d: unknown) => typeof d === "string" ? d : JSON.stringify(d)) };
  if (o.status === "missing") return { status: "missing", missing: o.missing ?? [] };
  if (o.status === "unsupported") return { status: "error", message: `هذه الرسالة غير متاحة للبناء الآلي الآن${typeof o.reason === "string" ? ` (${o.reason})` : ""}.` };
  return { status: "error", message: typeof o.note === "string" ? o.note : "تعذّر بناء الرسالة." };
}
