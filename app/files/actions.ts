"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { TFn } from "@/lib/i18n";

type Result = { ok: true } | { ok: false; message: string };
export type StoredFile = { path: string; name: string; size: number; type: string; sha256?: string };

const MAX_BYTES = 20 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function explain(msg: string, t: TFn): string {
  if (msg.includes("file type not allowed")) return t("files.e.type");
  if (msg.includes("not allowed")) return t("files.e.notAllowed");
  if (msg.includes("invalid file name")) return t("files.e.name");
  if (msg.includes("not found in storage") || msg.includes("path must start")) return t("files.e.notStored");
  if (msg.includes("base version changed")) return t("files.e.baseChanged");
  if (msg.includes("only a draft")) return t("files.e.notDraft");
  if (msg.includes("reason is required")) return t("files.e.reason");
  return t("fl.err.generic");
}

/** The browser has already stored the file under `<company>/library/`. This adds it to the library as version 1. */
export async function registerFile(companyId: string, f: StoredFile): Promise<Result> {
  const { t } = await getT();
  if (!UUID.test(companyId) || typeof f?.path !== "string" || !f.path.startsWith(`${companyId}/library/`) || f.path.includes("..")) return { ok: false, message: t("files.e.notStored") };
  if (typeof f.name !== "string" || !Number.isFinite(f.size) || f.size < 0 || f.size > MAX_BYTES) return { ok: false, message: t("files.e.notStored") };
  const sha = typeof f.sha256 === "string" && /^[0-9a-f]{64}$/.test(f.sha256) ? f.sha256 : null;
  const { error } = await (await createClient()).rpc("register_uploaded_file", { p_company_id: companyId, p_name: f.name, p_content_type: (f.type || "application/octet-stream").slice(0, 100), p_size_bytes: f.size, p_storage_path: f.path, p_sha256: sha });
  if (error) return { ok: false, message: explain(error.message, t) };
  revalidatePath("/files"); return { ok: true };
}

/** Approving makes the draft the current version; the previous one is kept as history. */
export async function approveVersion(fileId: string): Promise<Result> {
  const { t } = await getT();
  if (!UUID.test(fileId)) return { ok: false, message: t("fl.err.generic") };
  const { error } = await (await createClient()).rpc("approve_file_version", { p_file_id: fileId });
  if (error) return { ok: false, message: explain(error.message, t) };
  revalidatePath("/files"); return { ok: true };
}

export async function rejectVersion(fileId: string, reason: string): Promise<Result> {
  const { t } = await getT();
  const why = (reason ?? "").trim();
  if (!UUID.test(fileId)) return { ok: false, message: t("fl.err.generic") };
  if (why.length < 3 || why.length > 500) return { ok: false, message: t("files.e.reason") };
  const { error } = await (await createClient()).rpc("reject_file_version", { p_file_id: fileId, p_reason: why });
  if (error) return { ok: false, message: explain(error.message, t) };
  revalidatePath("/files"); return { ok: true };
}
