// Shapes returned by the eye_* database functions. The airline portal reads ONLY through those functions
// (SECURITY DEFINER, authenticated only); nothing in this module touches a table directly.
export type EyeRole = "airline_admin" | "airline_viewer" | "station_recorder";

export type EyeWorkspace = { workspace_id: string; name: string; role: EyeRole; station_id: string | null };

export type EyeStation = {
  station_id: string; name: string; airport_id: string | null; mode: string; status: string;
  coverage: "covered" | "pending_link" | "stopped";
  recorder: { name: string | null; org: string | null } | null;
};

export type EyeFlight = {
  turn_id: string; station_id: string; mode: string; direction: "arrival" | "departure";
  flight_number: string; scheduled_at: string; registration: string | null; linked_flight: string | null; in_block_at: string | null;
};

export type EyeMember = { member_id: string; user_id: string; name: string; org: string | null; role: EyeRole; station_id: string | null; status: "active" | "stopped"; email: string | null; is_me: boolean };
export type EyeInvite = { invite_id: string; name: string; org: string | null; email: string; role: EyeRole; station_id: string | null; expires_at: string };
export type EyeMembers = { members: EyeMember[]; invites: EyeInvite[] };
export type EyeLinkable = { company_id: string; company_name: string; station_id: string; station_name: string; airport_id: string | null; airport_iata: string | null; linked_station_id: string | null; link_status: string | null };
export type EyeAuditEntry = { id: number; at: string; action: string; details: Record<string, unknown>; actor_name: string | null };
export type EyeOwnerWorkspace = { workspace_id: string; name: string; airline_id: string; airline_name: string; status: string; created_at: string; members_active: number; members_stopped: number; invites_pending: number; stations_linked: number; stations_total: number; last_activity: string | null };

export type Result<T> = { ok: true; data: T } | { ok: false };
