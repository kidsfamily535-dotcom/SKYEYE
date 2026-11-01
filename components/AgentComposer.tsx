"use client";
import { useState, useTransition } from "react";
import { sendToAgent } from "@/app/agent/actions";
import { CMD_AR, type Opt } from "@/lib/agent-labels";

type Kind = "email" | "draft" | "request" | "flight";
const KINDS: { kind: Kind; label: string; targetType: string; cmds: string[] }[] = [
  { kind: "email", label: "إيميل", targetType: "email_message", cmds: ["answer_question", "retriage_email", "open_permit_files", "link_email_to_request", "rebuild_history", "employee_info"] },
  { kind: "draft", label: "مسودة رد", targetType: "reply_draft", cmds: ["redraft_reply", "answer_question"] },
  { kind: "request", label: "ملف طلب", targetType: "request_file", cmds: ["answer_question", "prepare_followup", "employee_info"] },
  { kind: "flight", label: "رحلة", targetType: "flight", cmds: ["answer_question", "prepare_followup", "employee_info"] },
];
const NEEDS_TEXT = new Set(["answer_question", "employee_info"]);
const HINT: Record<string, string> = {
  answer_question: "اكتب سؤالك للوكيل…", employee_info: "اكتب المعلومة التي تريد أن يعرفها الوكيل…", redraft_reply: "كيف تريد تعديل المسودة؟ (اختياري، والمسودة تبقى بالإنجليزية)",
};

export default function AgentComposer({ companyId, opts }: { companyId: string; opts: Record<Kind, Opt[]> }) {
  const [kind, setKind] = useState<Kind>("email");
  const [target, setTarget] = useState("");
  const [cmd, setCmd] = useState("answer_question");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const k = KINDS.find((x) => x.kind === kind)!;
  const list = opts[kind];
  const needText = NEEDS_TEXT.has(cmd);
  const pick = (n: Kind) => { setKind(n); setTarget(""); setCmd(KINDS.find((x) => x.kind === n)!.cmds[0]); setMsg(null); };

  return (
    <div className="open-form" aria-label="رسالة جديدة للوكيل">
      <div className="tabs" role="tablist" aria-label="الموضوع">
        {KINDS.map((x) => <button key={x.kind} type="button" role="tab" aria-selected={kind === x.kind} className={kind === x.kind ? "on" : ""} onClick={() => pick(x.kind)}>{x.label}</button>)}
      </div>
      <label>{k.label}<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">اختر…</option>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      {list.length === 0 && <p className="muted">لا توجد عناصر من هذا النوع بعد.</p>}
      <label>ماذا تريد من الوكيل؟<select value={cmd} onChange={(e) => setCmd(e.target.value)}>{k.cmds.map((c) => <option key={c} value={c}>{CMD_AR[c] ?? c}</option>)}</select></label>
      <label>الرسالة<textarea rows={4} maxLength={2000} value={text} placeholder={HINT[cmd] ?? "تفاصيل إضافية (اختياري)"} onChange={(e) => setText(e.target.value)} /></label>
      <p className="muted">الوكيل لا يرسل شيئاً خارج الشركة: ما يرجع لك مسودة أو معلومة تراجعها بنفسك.</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "muted" : "err"}>{msg.text}</p>}
      <div className="row"><button type="button" className="btn gold" disabled={pending || !target || (needText && !text.trim())} onClick={() => start(async () => {
        const r = await sendToAgent(companyId, cmd, k.targetType, target, text);
        setMsg(r.ok ? { ok: true, text: "وصلت الرسالة للوكيل." } : { ok: false, text: r.message });
        if (r.ok) setText("");
      })}>أرسل للوكيل</button></div>
    </div>
  );
}
