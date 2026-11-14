"use server";
import { createClient } from "@/lib/supabase/server";
import { getCommandCenter, type CommandCenter } from "@/lib/command-center";

/** Loads the movement messages and documents of a flight for the OTP reel, only when the reel scrolls into view
 *  (the database call behind it is heavy, so the flight page does not run it on every open). Read-only. */
export async function reelLoadCc(arrivalLeg: string): Promise<{ ok: true; data: CommandCenter } | { ok: false }> {
  if (!/^[0-9a-f-]{36}$/i.test(arrivalLeg)) return { ok: false };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false };
  const { data: m } = await sb.from("memberships").select("company_id").eq("user_id", user.id).maybeSingle();
  if (!m?.company_id) return { ok: false };
  return getCommandCenter(String(m.company_id), arrivalLeg);
}
