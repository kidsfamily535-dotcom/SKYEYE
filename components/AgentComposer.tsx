"use client";
import { useState, useTransition } from "react";
import Hint from "@/components/Hint";
import { sendToAgent } from "@/app/agent/actions";
import type { Opt } from "@/lib/agent-labels";
import { labelOf } from "@/lib/i18n";
import { useT } from "@/components/I18n";

type Kind = "email" | "draft" | "request" | "flight";
const KINDS: { kind: Kind; targetType: string; cmds: string[] }[] = [
  { kind: "email", targetType: "email_message", cmds: ["answer_question", "retriage_email", "open_permit_files", "link_email_to_request", "rebuild_history", "employee_info"] },
  { kind: "draft", targetType: "reply_draft", cmds: ["redraft_reply", "answer_question"] },
  { kind: "request", targetType: "request_file", cmds: ["answer_question", "prepare_followup", "employee_info"] },
  { kind: "flight", targetType: "flight", cmds: ["answer_question", "prepare_followup", "employee_info"] },
];
const NEEDS_TEXT = new Set(["answer_question", "employee_info"]);

export default function AgentComposer({ companyId, opts }: { companyId: string; opts: Record<Kind, Opt[]> }) {
  const { t, lang } = useT();
  const [kind, setKind] = useState<Kind>("email");
  const [target, setTarget] = useState("");
  const [cmd, setCmd] = useState("answer_question");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const k = KINDS.find((x) => x.kind === kind)!;
  const kindLabel = (x: { targetType: string }) => labelOf(lang, "agent.target", x.targetType);
  const placeholder = ["answer_question", "employee_info", "redraft_reply"].includes(cmd) ? t(`agent.ph.${cmd}` as "agent.ph.answer_question") : t("agent.ph.default");
  const list = opts[kind];
  const needText = NEEDS_TEXT.has(cmd);
  const pick = (n: Kind) => { setKind(n); setTarget(""); setCmd(KINDS.find((x) => x.kind === n)!.cmds[0]); setMsg(null); };

  return (
    <div className="open-form" aria-label={t("agent.composer.aria")}>
      <div className="tabs" role="tablist" aria-label={t("agent.composer.topic")}>
        {KINDS.map((x) => <button key={x.kind} type="button" role="tab" aria-selected={kind === x.kind} className={kind === x.kind ? "on" : ""} onClick={() => pick(x.kind)}>{kindLabel(x)}</button>)}
      </div>
      <label>{kindLabel(k)}<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">{t("agent.pick")}</option>{list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      {list.length === 0 && <p className="muted">{t("agent.noItems")}</p>}
      <label>{t("agent.what")}<select value={cmd} onChange={(e) => setCmd(e.target.value)}>{k.cmds.map((c) => <option key={c} value={c}>{labelOf(lang, "agent.cmd", c)}</option>)}</select></label>
      <label>{t("agent.msgLabel")}<textarea rows={4} maxLength={2000} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} /></label>
      <Hint>{t("agent.composer.hint")}</Hint>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "muted" : "err"}>{msg.text}</p>}
      <div className="row"><button type="button" className="btn gold" disabled={pending || !target || (needText && !text.trim())} onClick={() => start(async () => {
        const r = await sendToAgent(companyId, cmd, k.targetType, target, text);
        setMsg(r.ok ? { ok: true, text: t("agent.sent") } : { ok: false, text: r.message });
        if (r.ok) setText("");
      })}>{t("agent.send")}</button></div>
    </div>
  );
}
