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

export type AgentFile = { path: string; name: string; size: number; type: string };
const EXT = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg", "webp", "eml", "msg", "ppt", "pptx"]);
const MAX_FILES = 5, MAX_BYTES = 20 * 1024 * 1024;

/** Only files the browser already stored under this company's own agent folder may be attached; anything else is dropped. */
function cleanFiles(companyId: string, files: AgentFile[] | undefined): AgentFile[] {
  if (!Array.isArray(files)) return [];
  return files.slice(0, MAX_FILES).filter((f) =>
    f && typeof f.path === "string" && f.path.startsWith(`${companyId}/agent/`) && !f.path.includes("..")
    && typeof f.name === "string" && f.name.length > 0 && f.name.length <= 200
    && Number.isFinite(f.size) && f.size >= 0 && f.size <= MAX_BYTES
    && EXT.has((f.name.split(".").pop() ?? "").toLowerCase()),
  ).map((f) => ({ path: f.path, name: f.name, size: f.size, type: typeof f.type === "string" ? f.type.slice(0, 100) : "" }));
}

export async function sendToAgent(companyId: string, commandType: string, targetType: string, targetId: string, instruction: string, files?: AgentFile[]): Promise<Result> {
  const { t } = await getT();
  const text = instruction.trim();
  if (text.length > 2000) return { ok: false, message: t("agent.e.long") };
  const attached = cleanFiles(companyId, files);
  const { error } = await (await createClient()).rpc("send_agent_command", { p_company_id: companyId, p_command_type: commandType, p_target_type: targetType, p_target_id: targetId, p_instruction: text || null, p_payload: attached.length ? { files: attached } : {} });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}

export async function cancelAgentCommand(companyId: string, commandId: string): Promise<Result> {
  const { t } = await getT();
  const { error } = await (await createClient()).rpc("cancel_agent_command", { p_company_id: companyId, p_command_id: commandId });
  if (error) return { ok: false, message: explain(error.message, t) };
  refresh(); return { ok: true };
}
