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

export type Result<T> = { ok: true; data: T } | { ok: false };
