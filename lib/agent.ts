import { createClient } from "@/lib/supabase/server";

import { CMD_AR, STATUS_AR, TARGET_AR, type Opt } from "@/lib/agent-labels";
export { CMD_AR, STATUS_AR, TARGET_AR };
export type { Opt };

export type Cmd = { id: string; type: string; targetType: string; targetLabel: string | null; instruction: string | null; status: string; result: unknown; error: string | null; createdAt: string; claimedAt: string | null; finishedAt: string | null };
export type AgentPage = { companyId: string; canWrite: boolean; opts: { email: Opt[]; draft: Opt[]; request: Opt[]; flight: Opt[] }; commands: Cmd[]; active: number };

/** The agent's answer, only from what it actually wrote into `result`. Unknown shapes are never interpreted. */
export function answerText(result: unknown): string | null {
  if (!result || typeof result !== "object") return typeof result === "string" && result ? result : null;
  const r = result as Record<string, unknown>;
  for (const k of ["answer", "text", "message", "summary", "reply"]) if (typeof r[k] === "string" && r[k]) return r[k] as string;
  return null;
}

export async function getAgentPage(): Promise<AgentPage | null> {
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
    sb.from("agent_commands").select("id, command_type, target_type, target_id, instruction, status, result, error, created_at, claimed_at, finished_at").order("created_at", { ascending: false }).limit(40),
  ]);
  const cl = cmds.data ?? [];
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

  const commands: Cmd[] = cl.map((c) => ({ id: c.id, type: c.command_type, targetType: c.target_type, targetLabel: label.get(c.target_id) ?? null, instruction: c.instruction, status: c.status, result: c.result, error: c.error, createdAt: c.created_at, claimedAt: c.claimed_at, finishedAt: c.finished_at }));
  return {
    companyId: m.company_id, canWrite: m.role !== "viewer",
    opts: {
      email: (triage.data ?? []).map((t) => ({ id: t.message_id as string, label: subj.get(t.message_id as string) ?? t.summary ?? "(بدون عنوان)" })),
      draft: (drafts.data ?? []).map((d) => ({ id: d.id, label: d.subject ?? "(بدون عنوان)" })),
      request: (reqs.data ?? []).map((r) => ({ id: r.id, label: `${r.title}${r.flight_ref ? ` · ${r.flight_ref}` : ""}` })),
      flight: (flights.data ?? []).map((f) => ({ id: f.id, label: `${f.flight_number ?? "—"} · ${f.flight_date ?? "—"}` })),
    },
    commands, active: commands.filter((c) => c.status === "queued" || c.status === "running").length,
  };
}
