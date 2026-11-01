"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; took?: number } | { ok: false; message: string };

function explain(msg: string): string {
  if (msg.includes("employee profile required")) return "حسابك غير مربوط بملف موظف. اطلب من المسؤول إضافتك في الموظفين أولاً.";
  if (msg.includes("already acknowledged")) return "هذا التقرير استُلم من قبل.";
  if (msg.includes("HH:MM")) return "اكتب وقت البداية بصيغة 09:00 (بتوقيت UTC).";
  if (msg.includes("duration")) return "مدة الوردية يجب أن تكون بين نصف ساعة و24 ساعة.";
  if (msg.includes("name is required")) return "اكتب اسماً للوردية.";
  if (msg.includes("not allowed")) return "ليست لديك صلاحية لهذا الإجراء.";
  return "تعذّر تنفيذ الطلب. حاول مرة أخرى.";
}
const refresh = () => { revalidatePath("/handover"); revalidatePath("/requests"); revalidatePath("/"); };

export async function acknowledgeShift(reportId: string, note: string, takeRequests: boolean): Promise<Result> {
  const { data, error } = await (await createClient()).rpc("acknowledge_shift_report", { p_report_id: reportId, p_note: note.trim() || null, p_take_requests: takeRequests });
  if (error) return { ok: false, message: explain(error.message) };
  refresh();
  return { ok: true, took: Number((data as { took_requests?: number } | null)?.took_requests ?? 0) };
}

export async function saveShiftDefinition(companyId: string, name: string, startHhmm: string, durationHours: number, active: boolean): Promise<Result> {
  if (!Number.isFinite(durationHours)) return { ok: false, message: "اكتب مدة الوردية بالساعات." };
  const { error } = await (await createClient()).rpc("set_shift_definition", { p_company_id: companyId, p_name: name, p_start_hhmm: startHhmm.trim(), p_duration_minutes: Math.round(durationHours * 60), p_active: active });
  if (error) return { ok: false, message: explain(error.message) };
  refresh();
  return { ok: true };
}
