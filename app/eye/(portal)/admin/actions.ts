"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eyeMembers } from "@/lib/eye/api";

// Airline-administrator actions. Every call goes to a database function that re-checks that the caller is an active
// administrator of that very workspace, refuses self-changes and the last administrator, and writes the activity log.
// Nothing here deletes anything: stopping is always reversible.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function codeOf(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("your own")) return "self";
  if (m.includes("last active admin")) return "lastAdmin";
  if (m.includes("no active contract")) return "noContract";
  if (m.includes("already has a station")) return "airportTaken";
  if (m.includes("active recorder")) return "recorder";
  if (m.includes("not allowed")) return "notAllowed";
  if (m.includes("invalid") || m.includes("not found")) return "invalid";
  return "generic";
}
async function run(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { error } = await (await createClient()).rpc(fn, args);
  return error ? codeOf(error.message) : null;
}
function done(ws: string, err: string | null, anchor: string): never {
  revalidatePath("/eye/admin");
  redirect(`/eye/admin?ws=${ws}&${err ? `err=${err}` : "ok=1"}#${anchor}`);
}
const wsOf = (f: FormData) => { const ws = s(f, "ws"); if (!UUID.test(ws)) redirect("/eye"); return ws; };

export async function inviteUser(f: FormData): Promise<void> {
  const ws = wsOf(f); const email = s(f, "email").toLowerCase(); const name = s(f, "name"); const role = s(f, "role");
  if (!EMAIL.test(email) || email.length > 254 || name.length < 1 || name.length > 120 || !["airline_admin", "airline_viewer"].includes(role)) done(ws, "invalid", "users");
  const cur = await eyeMembers(ws);
  if (cur.ok && cur.data.members.some((m) => (m.email ?? "").toLowerCase() === email)) done(ws, "exists", "users");
  done(ws, await run("eye_invite", { p_ws: ws, p_email: email, p_name: name, p_role: role, p_station: null, p_org: null }), "users");
}
export async function cancelInvite(f: FormData): Promise<void> {
  const ws = wsOf(f); const id = s(f, "invite"); if (!UUID.test(id)) done(ws, "invalid", "users");
  done(ws, await run("eye_cancel_invite", { p_ws: ws, p_invite: id }), "users");
}
export async function setMemberStatus(f: FormData): Promise<void> {
  const ws = wsOf(f); const id = s(f, "member"); const st = s(f, "status");
  if (!UUID.test(id) || !["active", "stopped"].includes(st)) done(ws, "invalid", "users");
  done(ws, await run("eye_set_member_status", { p_ws: ws, p_member: id, p_status: st }), "users");
}
export async function setMemberRole(f: FormData): Promise<void> {
  const ws = wsOf(f); const id = s(f, "member"); const role = s(f, "role");
  if (!UUID.test(id) || !["airline_admin", "airline_viewer"].includes(role)) done(ws, "invalid", "users");
  done(ws, await run("eye_set_member_role", { p_ws: ws, p_member: id, p_role: role }), "users");
}
export async function linkStation(f: FormData): Promise<void> {
  const ws = wsOf(f); const company = s(f, "company"); const station = s(f, "station");
  if (!UUID.test(company) || !UUID.test(station)) done(ws, "invalid", "stations");
  done(ws, await run("eye_link_station", { p_ws: ws, p_company: company, p_station: station, p_name: null }), "stations");
}
export async function setStationLink(f: FormData): Promise<void> {
  const ws = wsOf(f); const station = s(f, "station");
  if (!UUID.test(station)) done(ws, "invalid", "stations");
  done(ws, await run("eye_set_station_link", { p_ws: ws, p_station: station, p_active: s(f, "active") === "true" }), "stations");
}
