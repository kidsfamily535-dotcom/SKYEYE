"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { TFn } from "@/lib/i18n";

type Result = { ok: true } | { ok: false; message: string };
function explain(msg: string, t: TFn): string {
  if (msg.includes("not allowed")) return t("fl.err.notAllowed");
  if (msg.includes("instruction text is required")) return t("agent.e.text");
  if (msg.includes("targets")) return t("agent.e.target");
  if (msg.includes("only a queued")) return t("agent.e.queued");
  if (msg.includes("char_length") || msg.includes("instruction_check")) return t("agent.e.long");
  return t("fl.err.generic");
}
const refresh = () => { revalidatePath("/agent"); };

export async function sendToAgent(companyId: string, commandType: string, targetType: string, targetId: string, instruction: string): Promise<Result> {
  const { t } = await getT();
  const text = instruction.trim();
  if (text.length > 2000) return { ok: false, message: t("agent.e.long") };
  const { error } = await (await createClient()).rpc("send_agent_command", { p_company_id: companyId, p_command_type: commandType, p_target_type: targetType, p_target_id: targetId, p_instruction: text || null, p_payload: {} });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function cancelAgentCommand(companyId: string, commandId: string): Promise<Result> {
  const { t } = await getT();
  const { error } = await (await createClient()).rpc("cancel_agent_command", { p_company_id: companyId, p_command_id: commandId });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}
