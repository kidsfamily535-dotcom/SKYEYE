import type { OtpState } from "@/lib/otp";

// eye_turn_state returns the same snapshot the SKYEYE stand scene uses, but without the proactive "warning" and "is_demo" fields.
// Only the tone level is derived here, from numbers the database already computed (nothing new is calculated).
type Ok = Extract<OtpState, { status: "ok" }>;

export function toOtpState(raw: Record<string, unknown>): OtpState | null {
  if (raw.status !== "ok" || typeof raw.turn_id !== "string" || !raw.snapshot) return null;
  const snapshot = raw.snapshot as Ok["snapshot"];
  const g = snapshot.ground;
  const level = g.state === "completed" ? "completed"
    : g.minutes_left !== null && g.minutes_left < 0 ? "exceeded"
    : (g.projected_overshoot_min ?? 0) > 0 ? "will_exceed"
    : g.minutes_left !== null ? "on_track" : "no_data";
  return {
    status: "ok", turn_id: raw.turn_id, is_demo: false, warning: { level, message: "", on_time: g.on_time },
    names: (raw.names ?? {}) as Ok["names"], events: (raw.events ?? []) as Ok["events"],
    starts: (raw.starts ?? []) as Ok["starts"], delays: (raw.delays ?? []) as Ok["delays"], snapshot,
  };
}
