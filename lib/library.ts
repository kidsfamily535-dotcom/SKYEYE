import { createClient } from "@/lib/supabase/server";

export const LIB_KINDS = ["flight", "aircraft", "permit", "complaint", "request", "shift", "baggage", "incident", "company", "station"] as const;
export type LibKind = (typeof LIB_KINDS)[number];
export const isLibKind = (v: unknown): v is LibKind => typeof v === "string" && (LIB_KINDS as readonly string[]).includes(v);

export type LibRow = { fileNo: string; kind: string; title: string | null; status: string; entries: number; lastEntryAt: string | null };
export type LibEntry = { id: string; type: string; at: string; summary: string | null; by: string };
export type LibDetail = {
  fileNo: string; kind: string; title: string | null; status: string; openedAt: string; closedAt: string | null; previousNos: string[];
  counts: Record<string, number>; entries: LibEntry[]; canWrite: boolean; fileId: string;
};
export type LibData = { rows: LibRow[]; detail: LibDetail | null | "missing"; canWrite: boolean } | null;

/** Search the company library and open one file. Row-level security and the RPCs already limit everything to the member's company. */
export async function getLibrary(q: string, kind: LibKind | null, open: { no: string; kind: LibKind } | null): Promise<LibData> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: m } = await sb.from("memberships").select("role, company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return null;
  const company = m.company_id as string;
  const canWrite = m.role !== "viewer";

  const { data: found } = await sb.rpc("library_lookup", { p_company: company, p_query: q || null, p_kind: kind, p_limit: 30 });
  const rows: LibRow[] = ((found ?? []) as Record<string, unknown>[]).map((r) => ({
    fileNo: r.file_no as string, kind: r.file_kind as string, title: (r.title as string | null) ?? null, status: r.status as string,
    entries: Number(r.entries ?? 0), lastEntryAt: (r.last_entry_at as string | null) ?? null,
  }));

  let detail: LibDetail | null | "missing" = null;
  if (open) {
    const { data: g } = await sb.rpc("library_get_file", { p_company: company, p_file_no: open.no, p_kind: open.kind });
    const j = g as { found?: boolean; file?: Record<string, unknown>; counts?: Record<string, number>; entries?: Record<string, unknown>[] } | null;
    if (j?.found && j.file) {
      detail = {
        fileId: j.file.id as string, fileNo: j.file.file_no as string, kind: j.file.file_kind as string, title: (j.file.title as string | null) ?? null,
        status: j.file.status as string, openedAt: j.file.opened_at as string, closedAt: (j.file.closed_at as string | null) ?? null,
        previousNos: (j.file.previous_nos as string[] | undefined) ?? [], counts: j.counts ?? {}, canWrite,
        entries: (j.entries ?? []).map((e) => ({ id: e.id as string, type: e.entry_type as string, at: e.occurred_at as string, summary: (e.summary as string | null) ?? null, by: e.added_by_kind as string })),
      };
    } else detail = "missing";
  }
  return { rows, detail, canWrite };
}

/** Number of the library file that belongs to a flight rotation (null when none exists yet). Row-level security limits it to the member's company. */
export async function getFlightFileNo(rotationId: string): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb.from("library_files").select("file_no").eq("file_kind", "flight").eq("flight_key", rotationId).limit(1).maybeSingle();
  return (data?.file_no as string | undefined) ?? null;
}
