import { createClient } from "@/lib/supabase/server";
import type { EyeAuditEntry, EyeFlight, EyeLinkable, EyeMembers, EyeOwnerWorkspace, EyeStation, EyeWorkspace, Result } from "./types";

// Server-side wrappers over the eye_* functions. The flight screens are read-only: the recording functions
// (eye_record_*, eye_set_in_block, eye_state_reason, eye_import_turns ...) are never called from the airline portal.
// The management functions (members, invites, station links, activity log) are called only from /eye/admin
// (airline administrator) and from the owner card in /admin; the database refuses everyone else.

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await (await createClient()).rpc(fn, args);
  if (error || data === null || data === undefined) return { ok: false };
  return { ok: true, data: data as T };
}

export const myWorkspaces = () => call<EyeWorkspace[]>("eye_my_workspaces");
export const eyeFlights = (ws: string) => call<EyeFlight[]>("eye_flights", { p_ws: ws });
export const eyeStations = (ws: string) => call<EyeStation[]>("eye_stations", { p_ws: ws });
export const eyeTurnState = (ws: string, turn: string, lang: string) => call<Record<string, unknown>>("eye_turn_state", { p_ws: ws, p_turn: turn, p_lang: lang });

export const eyeMembers = (ws: string) => call<EyeMembers>("eye_members_list", { p_ws: ws });
export const eyeLinkable = (ws: string) => call<EyeLinkable[]>("eye_linkable_stations", { p_ws: ws });
export const eyeAudit = (ws: string, before?: number) => call<EyeAuditEntry[]>("eye_audit_log", { p_ws: ws, p_limit: 30, p_before: before ?? null });
export const eyeOwnerOverview = () => call<EyeOwnerWorkspace[]>("eye_owner_overview");

/** The workspace the page works on: ?ws= if it is one of the user's own, else the first. The database re-checks membership on every call anyway. */
export function pickWorkspace(list: EyeWorkspace[], wanted?: string | null): EyeWorkspace | null {
  return list.find((w) => w.workspace_id === wanted) ?? list[0] ?? null;
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
