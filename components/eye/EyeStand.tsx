"use client";
import OtpStand from "@/components/OtpStand";
import type { OtpState } from "@/lib/otp";

// The shared stand scene, view only. canAct={false} removes every recording control from the scene
// (end / start / correct / reason buttons and the chocks-on form); this component never passes a rotation id or an action.
export default function EyeStand({ otp, flightLabel, registration }: { otp: OtpState; flightLabel: string; registration: string | null }) {
  return <OtpStand otp={otp} rotationId="" canAct={false} airline={null} flightLabel={flightLabel} registration={registration} />;
}
