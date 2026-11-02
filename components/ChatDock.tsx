"use client";
import { useState, useTransition } from "react";
import { sendToAgent } from "@/app/agent/actions";
import type { Opt } from "@/lib/agent-labels";
import type { Key } from "@/lib/i18n";
import { useT } from "@/components/I18n";

type Opts = { email: Opt[]; draft: Opt[]; request: Opt[]; flight: Opt[] };
const SUGGEST_COMPANY: Key[] = ["agent.sc.0", "agent.sc.1", "agent.sc.2", "agent.sc.3"];
const SUGGEST_ITEM: Key[] = ["agent.si.0", "agent.si.1", "agent.si.2"];

export default function ChatDock({ companyId, opts, initial, canWrite }: { companyId: string; opts: Opts; initial: { type: string; id: string } | null; canWrite: boolean }) {
  const { t: tr } = useT();
  const [ctx, setCtx] = useState(initial ? `${initial.type}:${initial.id}` : `company:${companyId}`);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cut = ctx.indexOf(":");
  const [tt, id] = [ctx.slice(0, cut), ctx.slice(cut + 1)];
  const isCompany = tt === "company";

  const send = (msg: string) => {
    const t = msg.trim();
    if (!t || pending) return;
    setErr(null);
    start(async () => {
      const r = await sendToAgent(companyId, "answer_question", tt, id, t);
      if (r.ok) setText(""); else setErr(r.message);
    });
  };

  if (!canWrite) return <p className="muted dock-note">{tr("agent.dock.viewOnly")}</p>;
  return (
    <div className="dock">
      <div className="dock-top">
        <label className="dock-ctx"><span className="muted">{tr("agent.dock.about")}</span>
          <select className="pick" value={ctx} onChange={(e) => setCtx(e.target.value)} aria-label={tr("agent.dock.topicAria")}>
            <option value={`company:${companyId}`}>{tr("agent.dock.company")}</option>
            {opts.flight.length > 0 && <optgroup label={tr("agent.target.flight")}>{opts.flight.map((o) => <option key={o.id} value={`flight:${o.id}`}>{o.label}</option>)}</optgroup>}
            {opts.request.length > 0 && <optgroup label={tr("agent.target.request_file")}>{opts.request.map((o) => <option key={o.id} value={`request_file:${o.id}`}>{o.label}</option>)}</optgroup>}
            {opts.email.length > 0 && <optgroup label={tr("agent.target.email_message")}>{opts.email.map((o) => <option key={o.id} value={`email_message:${o.id}`}>{o.label}</option>)}</optgroup>}
            {opts.draft.length > 0 && <optgroup label={tr("agent.target.reply_draft")}>{opts.draft.map((o) => <option key={o.id} value={`reply_draft:${o.id}`}>{o.label}</option>)}</optgroup>}
          </select>
        </label>
        <div className="sugg" aria-label={tr("agent.dock.sugg")}>
          {(isCompany ? SUGGEST_COMPANY : SUGGEST_ITEM).map((s) => <button key={s} type="button" className="btn ghost sm" disabled={pending} onClick={() => send(tr(s))}>{tr(s)}</button>)}
        </div>
      </div>
      {err && <p role="alert" className="err">{err}</p>}
      <div className="dock-row">
        <textarea rows={1} maxLength={2000} value={text} placeholder={tr("agent.dock.ph")} title={tr("agent.dock.title")} aria-label={tr("agent.dock.msgAria")}
          onChange={(e) => { setText(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        <button type="button" className="btn gold" disabled={pending || !text.trim()} onClick={() => send(text)}>{pending ? "…" : tr("agent.dock.send")}</button>
      </div>
    </div>
  );
}
