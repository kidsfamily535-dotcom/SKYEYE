import { createClient } from "@/lib/supabase/server";

export type FileChange = Record<string, unknown>;
export type LibFile = {
  id: string; name: string; contentType: string | null; size: number; version: number; status: "active" | "draft";
  source: string; category: string | null; createdAt: string; createdByKind: string; reason: string | null;
  changes: FileChange[]; changesTotal: number; parentId: string | null; url: string | null;
};
export type FilesData = { companyId: string; canWrite: boolean; active: LibFile[]; drafts: LibFile[] } | null;

/** Current versions and pending drafts of the company's files. Row-level security already limits rows to the member's company. */
export async function getFilesData(): Promise<FilesData> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: m } = await sb.from("memberships").select("role, company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return null;
  const { data } = await sb.from("company_files")
    .select("id,name,content_type,size_bytes,storage_bucket,storage_path,source,category,parent_file_id,version,status,edit_reason,edit_summary,created_by_kind,created_at")
    .eq("company_id", m.company_id).in("status", ["active", "draft"]).order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  const url = new Map<string, string>();
  for (const bucket of ["company-files", "email-attachments"]) {
    const paths = rows.filter((r) => r.storage_bucket === bucket).map((r) => r.storage_path as string);
    if (!paths.length) continue;
    const { data: signed } = await sb.storage.from(bucket).createSignedUrls(paths, 3600);
    for (const x of signed ?? []) if (x.path && x.signedUrl) url.set(`${bucket}/${x.path}`, x.signedUrl);
  }
  const files: LibFile[] = rows.map((r) => {
    const sum = (r.edit_summary ?? null) as { changes?: FileChange[]; changes_total?: number } | null;
    return {
      id: r.id as string, name: r.name as string, contentType: (r.content_type as string | null) ?? null, size: Number(r.size_bytes ?? 0),
      version: Number(r.version ?? 1), status: r.status as "active" | "draft", source: r.source as string, category: (r.category as string | null) ?? null, createdAt: r.created_at as string,
      createdByKind: r.created_by_kind as string, reason: (r.edit_reason as string | null) ?? null,
      changes: Array.isArray(sum?.changes) ? sum!.changes!.slice(0, 50) : [], changesTotal: Number(sum?.changes_total ?? sum?.changes?.length ?? 0),
      parentId: (r.parent_file_id as string | null) ?? null, url: url.get(`${r.storage_bucket}/${r.storage_path}`) ?? null,
    };
  });
  return { companyId: m.company_id as string, canWrite: m.role !== "viewer", active: files.filter((f) => f.status === "active"), drafts: files.filter((f) => f.status === "draft") };
}
