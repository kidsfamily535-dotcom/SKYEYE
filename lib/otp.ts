import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n";

// OTP (on-time performance) read model for one rotation. Everything comes from the DB function otp_turn_state:
// no times or numbers are computed or guessed here, only shaped for display.

export type OtpStepState = "done" | "done_late" | "upcoming" | "in_window" | "overdue_unconfirmed";

export type OtpStep = {
  step_seq: number; step_code: string; step_state: OtpStepState; pred_code: string | null;
  planned_end: string | null; expected_end: string | null; actual_end: string | null; actual_start: string | null;
  late_vs_plan_min: number | null; own_delay_min: number | null; start_delay_min: number | null; needs_start: boolean;
  step_name_ar: string | null;
};

export type OtpGround = {
  state: string; on_time: boolean | null; is_estimate: boolean; defs_approved: boolean;
  minutes_left: number | null; allowed_ground_min: number | null; elapsed_ground_min: number | null;
  original_std: string | null; target_departure: string | null; projected_off_block: string | null;
  projected_overshoot_min: number | null; external_arrival_shift_min: number | null;
};

export type OtpAttribution = { kind: string; category: string; minutes: number; step_code: string | null };

export type OtpWarning = { level: string; message: string; on_time?: boolean | null } | null;

export type OtpEvent = { milestone: string; occurred_at: string; recorded_at: string; source: string | null; note: string | null; corrected: boolean };
export type OtpDelay = { milestone: string; reason_key: string; reason: string; responsibility: string | null; minutes: number | null; note: string | null; at: string };

export type OtpState =
  | { status: "no_turn"; can_open: boolean; sta: string | null; std: string | null; body_class: string | null }
  | {
      status: "ok"; turn_id: string; is_demo: boolean; warning: OtpWarning; names: Record<string, string>;
      events: OtpEvent[]; starts: { milestone: string; started_at: string }[]; delays: OtpDelay[];
      snapshot: {
        turn: { flight_in: string | null; flight_out: string | null; registration: string | null; body_class: string; sta: string; std: string; in_block_at: string | null };
        steps: OtpStep[]; ground: OtpGround; attribution: OtpAttribution[]; ground_attribution: OtpAttribution[];
        projected_departure_delay_min?: number | null;
      };
    };

export async function getOtp(rotationId: string, lang: Lang): Promise<OtpState | null> {
  const { data, error } = await (await createClient()).rpc("otp_turn_state", { p_rotation_id: rotationId, p_lang: lang });
  if (error || !data) return null;
  return data as OtpState;
}
