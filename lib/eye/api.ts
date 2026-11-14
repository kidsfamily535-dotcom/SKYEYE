import { createClient } from "@/lib/supabase/server";
import type { EyeFlight, EyeStation, EyeWorkspace, Result } from "./types";

// Server-side wrappers over the eye_* functions. Read-only on purpose: the recording functions
// (eye_record_*, eye_set_in_block, eye_state_reason, eye_import_turns, eye_invite ...) are never called from the airline portal.

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await (await createClient()).rpc(fn, args);
  if (error || data === null || data === undefined) return { ok: false };
  return { ok: true, data: data as T };
}

export const myWorkspaces = () => call<EyeWorkspace[]>("eye_my_workspaces");
export const eyeFlights = (ws: string) => call<EyeFlight[]>("eye_flights", { p_ws: ws });
export const eyeStations = (ws: string) => call<EyeStation[]>("eye_stations", { p_ws: ws });
export const eyeTurnState = (ws: string, turn: string, lang: string) => call<Record<string, unknown>>("eye_turn_state", { p_ws: ws, p_turn: turn, p_lang: lang });

/** The workspace the page works on: ?ws= if it is one of the user's own, else the first. The database re-checks membership on every call anyway. */
export function pickWorkspace(list: EyeWorkspace[], wanted?: string | null): EyeWorkspace | null {
  return list.find((w) => w.workspace_id === wanted) ?? list[0] ?? null;
}

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
