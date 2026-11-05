import { createClient } from "@/lib/supabase/server";

import type { Opt } from "@/lib/agent-labels";
import { getT } from "@/lib/lang";
export type { Opt };

export type Cmd = { createdBy: string | null; senderName: string | null; mine: boolean; id: string; type: string; targetType: string; targetLabel: string | null; instruction: string | null; files: { name: string; size: number }[]; status: string; result: unknown; error: string | null; createdAt: string; claimedAt: string | null; finishedAt: string | null };
export type AgentPage = { companyId: string; canWrite: boolean; ctx: { type: string; id: string } | null; opts: { email: Opt[]; draft: Opt[]; request: Opt[]; flight: Opt[] }; commands: Cmd[]; active: number };

/** The agent's answer, only from what it actually wrote into `result`. Unknown shapes are never interpreted. */
export function answerText(result: unknown): string | null {
  if (!result || typeof result !== "object") return typeof result === "string" && result ? result : null;
  const r = result as Record<string, unknown>;
  for (const k of ["answer", "answer_ar", "note_ar", "text", "message", "summary", "reply"]) if (typeof r[k] === "string" && r[k]) return r[k] as string;
  return null;
}

/** For a message the agent composed (a draft only, never sent): the exact text, if it wrote one. */
export function draftTextOf(result: unknown): string | null {
  const r = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  if (!r || r.kind !== "message_draft") return null;
  const c = r.composed && typeof r.composed === "object" ? (r.composed as Record<string, unknown>) : null;
  for (const k of ["text", "body_text", "message", "body"]) if (c && typeof c[k] === "string" && c[k]) return c[k] as string;
  return null;
}

/** Files the employee attached to this message (names and sizes only, exactly as stored in the command payload). */
export function filesOf(payload: unknown): { name: string; size: number }[] {
  const r = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  if (!r || !Array.isArray(r.files)) return [];
  return r.files.flatMap((f) => (f && typeof f === "object" && typeof (f as Record<string, unknown>).name === "string" ? [{ name: (f as { name: string }).name, size: Number((f as { size?: unknown }).size) || 0 }] : []));
}

/** Sources the agent cited (strings only, exactly as written). */
export function sourcesOf(result: unknown): string[] {
  const r = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  return r && Array.isArray(r.sources) ? r.sources.filter((x): x is string => typeof x === "string") : [];
}
/** Field names the agent said it still needs from the employee. */
export function missingOf(result: unknown): string[] {
  const r = result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  if (!r || !Array.isArray(r.missing)) return [];
  return r.missing.map((m) => (m && typeof m === "object" && typeof (m as Record<string, unknown>).field === "string" ? ((m as Record<string, unknown>).field as string) : null)).filter((x): x is string => !!x);
}

export async function getAgentPage(want?: { flight?: string }): Promise<AgentPage | null> {
  const { t: tx } = await getT();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: m } = await sb.from("memberships").select("role, company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return null;

  const [triage, drafts, reqs, flights, cmds] = await Promise.all([
    sb.from("email_triage").select("message_id, summary").order("created_at", { ascending: false }).limit(30),
    sb.from("email_reply_drafts").select("id, subject").eq("status", "draft").order("created_at", { ascending: false }).limit(30),
    sb.from("request_files").select("id, title, flight_ref").eq("status", "open").order("created_at", { ascending: false }).limit(30),
    sb.from("flights").select("id, flight_number, flight_date").order("flight_date", { ascending: false }).limit(30),
    sb.from("agent_commands").select("id, command_type, target_type, target_id, instruction, payload, status, result, error, created_at, claimed_at, finished_at, created_by").order("created_at", { ascending: false }).limit(40),
  ]);
  const cl = [...(cmds.data ?? [])].reverse();
  const ids = (t: string) => [...new Set(cl.filter((c) => c.target_type === t).map((c) => c.target_id as string))];
  const [mailIds, draftIds, reqIds, fltIds] = [ids("email_message"), ids("reply_draft"), ids("request_file"), ids("flight")];
  const triageMsgIds = (triage.data ?? []).map((t) => t.message_id as string);
  const allMail = [...new Set([...mailIds, ...triageMsgIds])];
  const [mails, dr, rf, fl] = await Promise.all([
    allMail.length ? sb.from("email_messages").select("id, subject").in("id", allMail) : Promise.resolve({ data: [] as { id: string; subject: string | null }[] }),
    draftIds.length ? sb.from("email_reply_drafts").select("id, subject").in("id", draftIds) : Promise.resolve({ data: [] as { id: string; subject: string | null }[] }),
    reqIds.length ? sb.from("request_files").select("id, title").in("id", reqIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    fltIds.length ? sb.from("flights").select("id, flight_number").in("id", fltIds) : Promise.resolve({ data: [] as { id: string; flight_number: string | null }[] }),
  ]);
  const label = new Map<string, string | null>([...(mails.data ?? []).map((x) => [x.id, x.subject] as [string, string | null]), ...(dr.data ?? []).map((x) => [x.id, x.subject] as [string, string | null]), ...(rf.data ?? []).map((x) => [x.id, x.title] as [string, string | null]), ...(fl.data ?? []).map((x) => [x.id, x.flight_number] as [string, string | null])]);
  const subj = new Map((mails.data ?? []).map((x) => [x.id, x.subject]));

  const [mem, emp] = await Promise.all([
    sb.from("memberships").select("id, user_id").eq("company_id", m.company_id),
    sb.from("employees").select("membership_id, full_name").eq("company_id", m.company_id),
  ]);
  const uidOfMem = new Map((mem.data ?? []).map((x) => [x.id as string, x.user_id as string]));
  const nameOfUser = new Map<string, string>();
  for (const e of emp.data ?? []) { const u = uidOfMem.get(e.membership_id as string); if (u && e.full_name) nameOfUser.set(u, e.full_name as string); }

  let ctx: { type: string; id: string } | null = null;
  const flightOpts = (flights.data ?? []).map((f) => ({ id: f.id, label: `${f.flight_number ?? "—"} · ${f.flight_date ?? "—"}` }));
  if (want?.flight && /^[0-9a-f-]{36}$/i.test(want.flight)) {
    const { data: wf } = await sb.from("flights").select("id, flight_number, flight_date").eq("id", want.flight).maybeSingle();
    if (wf) { ctx = { type: "flight", id: wf.id }; if (!flightOpts.some((o) => o.id === wf.id)) flightOpts.unshift({ id: wf.id, label: `${wf.flight_number ?? "—"} · ${wf.flight_date ?? "—"}` }); }
  }

  const commands: Cmd[] = cl.map((c) => ({ createdBy: c.created_by ?? null, senderName: c.created_by ? nameOfUser.get(c.created_by) ?? null : null, mine: !!c.created_by && c.created_by === user.id, id: c.id, type: c.command_type, targetType: c.target_type, targetLabel: label.get(c.target_id) ?? null, instruction: c.instruction, files: filesOf(c.payload), status: c.status, result: c.result, error: c.error, createdAt: c.created_at, claimedAt: c.claimed_at, finishedAt: c.finished_at }));
  return {
    companyId: m.company_id, canWrite: m.role !== "viewer", ctx,
    opts: {
      email: (triage.data ?? []).map((t) => ({ id: t.message_id as string, label: subj.get(t.message_id as string) ?? t.summary ?? tx("agent.noSubject") })),
      draft: (drafts.data ?? []).map((d) => ({ id: d.id, label: d.subject ?? tx("agent.noSubject") })),
      request: (reqs.data ?? []).map((r) => ({ id: r.id, label: `${r.title}${r.flight_ref ? ` · ${r.flight_ref}` : ""}` })),
      flight: flightOpts,
    },
    commands, active: commands.filter((c) => c.status === "queued" || c.status === "running").length,
  };
}
