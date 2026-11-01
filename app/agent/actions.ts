"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAgentTargets, getAgentThread, type AgentTargets, type ThreadItem } from "@/lib/agent";

type Result = { ok: true } | { ok: false; message: string };
function explain(msg: string): string {
  if (msg.includes("not allowed")) return "ليست لديك صلاحية الكتابة في هذه الشركة.";
  if (msg.includes("instruction text is required")) return "اكتب نص السؤال أو المعلومة أولاً.";
  if (msg.includes("targets")) return "هذا الأمر لا يناسب الموضوع المختار.";
  if (msg.includes("only a queued")) return "لا يُلغى إلا الأمر الذي لم يبدأ الوكيل فيه.";
  if (msg.includes("char_length") || msg.includes("instruction_check")) return "النص أطول من 2000 حرف.";
  return "تعذّر تنفيذ الطلب. حاول مرة أخرى.";
}
const refresh = () => { revalidatePath("/agent"); };

export async function sendToAgent(companyId: string, commandType: string, targetType: string, targetId: string, instruction: string): Promise<Result> {
  const text = instruction.trim();
  if (text.length > 2000) return { ok: false, message: "النص أطول من 2000 حرف." };
  const { error } = await (await createClient()).rpc("send_agent_command", { p_company_id: companyId, p_command_type: commandType, p_target_type: targetType, p_target_id: targetId, p_instruction: text || null, p_payload: {} });
  if (error) return { ok: false, message: explain(error.message) };
  refresh(); return { ok: true };
}

/** The command bar loads these on demand, so no page pays for them unless the employee opens the subject list. */
export async function loadAgentTargets(): Promise<AgentTargets> {
  return getAgentTargets();
}

export async function loadAgentThread(targetType: string | null, targetId: string | null): Promise<ThreadItem[]> {
  return getAgentThread(targetType, targetId);
}

export async function cancelAgentCommand(companyId: string, commandId: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("cancel_agent_command", { p_company_id: companyId, p_command_id: commandId });
  if (error) return { ok: false, message: explain(error.message) };
  refresh(); return { ok: true };
}
