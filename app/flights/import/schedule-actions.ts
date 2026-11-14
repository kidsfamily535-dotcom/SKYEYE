"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import type { TFn } from "@/lib/i18n";

export type SchedulePrepareSummary = {
  legs?: number; pages?: number; aircraft?: number; schedule?: string; period?: [string, string];
  counts?: { turnaround?: number; wait_next_schedule?: number; wait_previous_schedule?: number };
  flagged_turnarounds?: number; warnings?: string[];
};
export type SchedulePrepareItem = {
  id: string; fileName: string; status: string; error: string | null; createdAt: string;
  summary: SchedulePrepareSummary | null; excelUrl: string | null; note: string | null;
};
export type UploadedSchedule = { path: string; name: string; size: number; type: string };
type Result = { ok: true; already: boolean; noteSaved: boolean } | { ok: false; message: string };
const MAX_NOTE = 1000;

const MAX_BYTES = 20 * 1024 * 1024;

function explain(msg: string, t: TFn): string {
  if (msg.includes("only PDF")) return t("sp.e.pdfOnly");
  if (msg.includes("not allowed")) return t("sp.e.notAllowed");
  if (msg.includes("file was not uploaded") || msg.includes("bad storage path")) return t("sp.e.notStored");
  return t("fl.err.generic");
}

/**
 * The browser has already stored the PDF under `<company>/schedules/`. This registers it and asks the agent to prepare it.
 * Nothing is written to flights here: the agent only produces an Excel for the employee to review.
 */
export async function requestSchedulePrepare(companyId: string, file: UploadedSchedule, note?: string): Promise<Result> {
  const { t } = await getT();
  const okName = typeof file?.name === "string" && /\.pdf$/i.test(file.name) && file.name.length <= 255 && !/[/\\]/.test(file.name);
  const okPath = typeof file?.path === "string" && file.path.startsWith(`${companyId}/schedules/`) && !file.path.includes("..");
  if (!okName) return { ok: false, message: t("sp.e.pdfOnly") };
  if (!okPath || !Number.isFinite(file.size) || file.size < 0 || file.size > MAX_BYTES) return { ok: false, message: t("sp.e.notStored") };
  const sb = await createClient();
  const reg = await sb.rpc("register_schedule_upload", { p_company_id: companyId, p_name: file.name, p_storage_path: file.path, p_size: file.size, p_content_type: "application/pdf" });
  if (reg.error || !reg.data) return { ok: false, message: explain(reg.error?.message ?? "", t) };
  const req = await sb.rpc("schedule_prepare_request", { p_file_id: reg.data as string });
  if (req.error) return { ok: false, message: explain(req.error.message, t) };
  // The note travels with the request. A failed note never cancels the request: the employee is told and can write it again.
  const text = typeof note === "string" ? note.trim().slice(0, MAX_NOTE) : "";
  let noteSaved = true;
  if (text) {
    const n = await sb.rpc("schedule_prepare_set_note", { p_file_id: reg.data as string, p_note: text });
    noteSaved = !n.error;
  }
  revalidatePath("/flights/import");
  return { ok: true, already: !!(req.data as { already?: boolean } | null)?.already, noteSaved };
}

/** Latest preparations for the employee's company (row-level security limits this to their own company). Download links are fresh and short-lived. */
export async function listSchedulePrepares(): Promise<SchedulePrepareItem[]> {
  const sb = await createClient();
  const { data } = await sb.from("schedule_prepare_log").select("id,file_name,status,error,summary,excel_path,created_at,note").order("created_at", { ascending: false }).limit(8);
  const rows = data ?? [];
  const paths = rows.map((r) => r.excel_path as string | null).filter((p): p is string => !!p);
  const signed = paths.length ? await sb.storage.from("generated").createSignedUrls(paths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id as string, fileName: r.file_name as string, status: r.status as string, error: (r.error as string | null) ?? null,
    createdAt: r.created_at as string, summary: (r.summary as SchedulePrepareSummary | null) ?? null,
    excelUrl: r.excel_path ? url.get(r.excel_path as string) ?? null : null, note: (r.note as string | null) ?? null,
  }));
}

/** Used by the polling component so the list updates without reloading the page. */
export async function refreshSchedulePrepares(): Promise<SchedulePrepareItem[]> { return listSchedulePrepares(); }
