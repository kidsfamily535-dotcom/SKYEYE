import { createClient } from "@/lib/supabase/server";

/** Shape returned by public.flight_command_center(company, flight). Read-only: the database builds it, the screen only shows it. */
export type CcField = { field: string; label: string; format: string };
export type CcDraft = { id: string; status: string; edits: number; sent_at: string | null; warnings: string[]; body_text: string; created_at: string };
export type CcStep = {
  seq: number;
  cycle: "receive" | "send";
  /** none = no draft yet, draft = draft ready, incoming = we only wait for it, internal = ground services (no message) */
  state: "none" | "draft" | "incoming" | "internal" | string;
  title: string | null;
  step_type: string;
  format_type: string | null;
  direction: "incoming" | "outgoing" | "internal" | string;
  composable: boolean;
  trigger_ar: string | null;
  note_ar: string | null;
  required: CcField[] | null;
  optional: CcField[] | null;
  required_unless: (CcField & { unless: string })[] | null;
  draft: CcDraft | null;
  for_flight_id: string;
};
export type CcOther = { type: string; title: string; composable: boolean; required: CcField[] | null; optional: CcField[] | null };
export type CcDocType = { code: string; name_ar: string; name_en: string; scope: string | null; has_template: boolean; template_id: string | null; template_name: string | null };
export type CommandCenter = {
  status: string;
  flight: { id: string; station: string | null; flight_number: string | null; registration: string | null; arrival_leg_id: string; departure_leg_id: string };
  movement: { steps: CcStep[]; other_messages: CcOther[]; order_approved: boolean; note_ar: string | null };
  documents: { types: CcDocType[]; prepared: Record<string, any>[] };
};

export async function getCommandCenter(companyId: string, flightId: string): Promise<{ ok: true; data: CommandCenter } | { ok: false }> {
  const { data, error } = await (await createClient()).rpc("flight_command_center", { p_company_id: companyId, p_flight_id: flightId });
  if (error || !data || (data as any).status !== "ok") return { ok: false };
  return { ok: true, data: data as CommandCenter };
}
