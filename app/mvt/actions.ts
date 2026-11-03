"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";

export type MvtResult = { ok: true; status: "approved" | "rejected" | "conflict"; detail?: string } | { ok: false; message: string };

export async function reviewMvt(parsedId: string, decision: "approve" | "reject", flightId?: string): Promise<MvtResult> {
  const { t } = await getT();
  const { data, error } = await (await createClient()).rpc("review_parsed_message", { p_parsed_id: parsedId, p_decision: decision, p_flight_id: flightId ?? null });
  if (error) return { ok: false, message: t("mvt.err") };
  const r = data as { status?: string; conflicts?: { event_type: string; existing_at: string; new_at: string }[] } | null;
  if (r?.status === "conflict") {
    const hm = (s: string) => new Date(s).toISOString().slice(11, 16);
    return { ok: true, status: "conflict", detail: (r.conflicts ?? []).map((c) => `${c.event_type} ${hm(c.existing_at)} → ${hm(c.new_at)}`).join(" · ") };
  }
  revalidatePath("/mvt"); revalidatePath("/"); revalidatePath("/flights");
  return { ok: true, status: decision === "approve" ? "approved" : "rejected" };
}
