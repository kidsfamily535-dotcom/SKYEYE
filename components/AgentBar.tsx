"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { loadAgentTargets, loadAgentThread, sendToAgent } from "@/app/agent/actions";
import { CMDS_BY_TARGET, CMD_AR, NEEDS_TEXT, STATUS_AR, TARGET_AR } from "@/lib/agent-labels";
import type { AgentTargets, ThreadItem } from "@/lib/agent";

export type AgentCtx = { targetType: string; targetId: string; label: string };

const TONE: Record<string, string> = { queued: "warn", running: "info", done: "ok", failed: "late", cancelled: "info" };
const GROUPS: { key: keyof AgentTargets; label: string; targetType: string }[] = [
  { key: "email", label: "إيميل", targetType: "email_message" },
  { key: "draft", label: "مسودة رد", targetType: "reply_draft" },
  { key: "request", label: "ملف طلب", targetType: "request_file" },
  { key: "flight", label: "رحلة", targetType: "flight" },
];
const HINT: Record<string, string> = {
  answer_question: "اكتب أمرك أو سؤالك للوكيل…", employee_info: "اكتب المعلومة التي تريد أن يعرفها الوكيل…", redraft_reply: "كيف تريد تعديل المسودة؟ (اختياري)",
};

/**
 * A command bar fixed at the bottom of every page. On a flight, email or request page the command is bound to it automatically;
 * elsewhere the employee picks the subject from a list that is only loaded when asked for. The agent's answer appears in the panel above.
 * Commands go to the `agent_commands` queue: until an agent program exists they stay "waiting for the agent" and nothing is executed.
 */
export default function AgentBar({ companyId, canWrite, ctx }: { companyId: string; canWrite: boolean; ctx: AgentCtx | null }) {
  const [picked, setPicked] = useState("");            // "targetType:id" when the page has no subject
  const [targets, setTargets] = useState<AgentTargets | null>(null);
  const [cmd, setCmd] = useState("answer_question");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ThreadItem[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const [pType, pId] = picked ? [picked.slice(0, picked.indexOf(":")), picked.slice(picked.indexOf(":") + 1)] : [null, null];
  const targetType = ctx?.targetType ?? pType;
  const targetId = ctx?.targetId ?? pId;
  const cmds = targetType ? CMDS_BY_TARGET[targetType] ?? ["answer_question"] : ["answer_question"];
  const needText = NEEDS_TEXT.has(cmd);
  const hasTarget = !!(targetType && targetId);

  const reload = useCallback(async () => { setThread(await loadAgentThread(targetType, targetId)); }, [targetType, targetId]);

  // Load the thread when the panel opens, and every 8 seconds while something is still waiting or running. Idle: no polling.
  useEffect(() => { if (open) void reload(); }, [open, reload]);
  const active = !!thread?.some((t) => t.status === "queued" || t.status === "running");
  useEffect(() => { if (!open || !active) return; const t = setInterval(() => void reload(), 8000); return () => clearInterval(t); }, [open, active, reload]);

  const loadTargets = () => { if (!targets) void loadAgentTargets().then(setTargets); };
  const choose = (v: string) => {
    setPicked(v); setMsg(null);
    const t = v ? v.slice(0, v.indexOf(":")) : null;
    setCmd(t && CMDS_BY_TARGET[t]?.includes("answer_question") ? "answer_question" : t ? CMDS_BY_TARGET[t][0] : "answer_question");
  };

  if (!canWrite) {
    return <div className="agentbar" role="region" aria-label="قل للوكيل"><p className="muted">صلاحية المشاهدة لا تسمح بإرسال أوامر للوكيل.</p></div>;
  }

  return (
    <div className="agentbar" role="region" aria-label="قل للوكيل">
      {open && (
        <div className="agentpanel" aria-live="polite">
          <div className="row between">
            <b>ردّ الوكيل{ctx ? <> · <bdi>{ctx.label}</bdi></> : ""}</b>
            <span className="row">
              <Link className="btn ghost sm" href="/agent">سجل المحادثة كاملاً</Link>
              <button type="button" className="btn ghost sm" onClick={() => setOpen(false)} aria-label="إخفاء ردّ الوكيل">إخفاء</button>
            </span>
          </div>
          {thread === null && <p className="muted">جارٍ التحميل…</p>}
          {thread?.length === 0 && <p className="muted">لا رسائل بعد{ctx ? " على هذا العنصر" : ""}. اكتب أمرك في الشريط أدناه.</p>}
          <ol className="chat compact">
            {thread?.map((c) => (
              <li key={c.id}>
                <div className="bubble me">
                  <b>{CMD_AR[c.type] ?? c.type}</b>
                  {!ctx && <small className="muted">{TARGET_AR[c.targetType] ?? c.targetType}{c.targetLabel ? <>: <bdi className="ltr">{c.targetLabel}</bdi></> : ""}</small>}
                  {c.instruction && <p><bdi>{c.instruction}</bdi></p>}
                </div>
                <div className="bubble agent">
                  <span className={`tag ${TONE[c.status] ?? "info"}`}>{STATUS_AR[c.status] ?? c.status}</span>
                  {c.status === "queued" && <small className="muted">لم يأخذه الوكيل بعد.</small>}
                  {c.status === "done" && (c.answer ? <p><bdi>{c.answer}</bdi></p> : <small className="muted">نفّذه الوكيل ولم يكتب نصاً للرد. التفاصيل في سجل المحادثة.</small>)}
                  {c.status === "failed" && <small className="err">{c.error ?? "فشل التنفيذ دون سبب مسجّل."}</small>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <form className="agentform" onSubmit={(e) => {
        e.preventDefault();
        if (!hasTarget || pending || (needText && !text.trim())) return;
        start(async () => {
          const r = await sendToAgent(companyId, cmd, targetType!, targetId!, text);
          setMsg(r.ok ? { ok: true, text: "وصلت الرسالة للوكيل." } : { ok: false, text: r.message });
          if (r.ok) { setText(""); setOpen(true); await reload(); }
        });
      }}>
        <span className="agent-label" aria-hidden="true">قل للوكيل</span>
        {ctx ? (
          <span className="chip ctx" title="الأمر مربوط تلقائياً بما تفتحه الآن">{TARGET_AR[ctx.targetType] ?? ctx.targetType}: <bdi className="ltr">{ctx.label}</bdi></span>
        ) : (
          <select aria-label="موضوع الأمر" value={picked} onFocus={loadTargets} onMouseDown={loadTargets} onChange={(e) => choose(e.target.value)}>
            <option value="">اختر الموضوع…</option>
            {targets && GROUPS.map((g) => targets[g.key].length > 0 && (
              <optgroup key={g.key} label={g.label}>{targets[g.key].map((o) => <option key={o.id} value={`${g.targetType}:${o.id}`}>{o.label}</option>)}</optgroup>
            ))}
          </select>
        )}
        {cmds.length > 1 && (
          <select aria-label="نوع الأمر" value={cmd} onChange={(e) => setCmd(e.target.value)}>{cmds.map((c) => <option key={c} value={c}>{CMD_AR[c] ?? c}</option>)}</select>
        )}
        <input aria-label="الأمر للوكيل" value={text} maxLength={2000} placeholder={hasTarget ? HINT[cmd] ?? "تفاصيل إضافية (اختياري)" : "افتح رحلة أو إيميل أو طلباً، أو اختر الموضوع أولاً"} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn gold" disabled={pending || !hasTarget || (needText && !text.trim())}>أرسل</button>
        <button type="button" className="btn ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "إخفاء الرد" : "ردّ الوكيل"}{active ? " ●" : ""}</button>
      </form>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "muted" : "err"}>{msg.text}</p>}
    </div>
  );
}
