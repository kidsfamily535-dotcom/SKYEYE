"use client";
import { useRef, useState, useTransition } from "react";
import { sendToAgent, type AgentFile } from "@/app/agent/actions";
import { createClient } from "@/lib/supabase/client";
import type { Opt } from "@/lib/agent-labels";
import type { Key } from "@/lib/i18n";
import { useT } from "@/components/I18n";

type Opts = { email: Opt[]; draft: Opt[]; request: Opt[]; flight: Opt[] };
const SUGGEST_COMPANY: Key[] = ["agent.sc.0", "agent.sc.1", "agent.sc.2", "agent.sc.3"];
const MAX_FILES = 5, MAX_BYTES = 20 * 1024 * 1024;
const EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "png", "jpg", "jpeg", "webp", "eml", "msg", "ppt", "pptx"];
const ACCEPT = EXT.map((e) => `.${e}`).join(",");
const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase();
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
/** Storage keys stay ASCII; the real name travels in the message and is shown to the employee. */
const safeKey = (n: string) => { const e = extOf(n); const base = n.slice(0, Math.max(0, n.length - e.length - 1)).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "file"; return `${base}.${e}`; };

const SUGGEST_ITEM: Key[] = ["agent.si.0", "agent.si.1", "agent.si.2"];

export default function ChatDock({ companyId, opts, initial, canWrite }: { companyId: string; opts: Opts; initial: { type: string; id: string } | null; canWrite: boolean }) {
  const { t: tr } = useT();
  const [ctx, setCtx] = useState(initial ? `${initial.type}:${initial.id}` : `company:${companyId}`);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const stored = useRef(new Map<File, AgentFile>());
  const input = useRef<HTMLInputElement>(null);
  const cut = ctx.indexOf(":");
  const [tt, id] = [ctx.slice(0, cut), ctx.slice(cut + 1)];
  const isCompany = tt === "company";

  const pick = (list: FileList | null) => {
    if (!list) return;
    const next = [...files]; let problem: string | null = null;
    for (const f of Array.from(list)) {
      if (!EXT.includes(extOf(f.name))) { problem = tr("agent.up.type", { name: f.name }); continue; }
      if (f.size > MAX_BYTES) { problem = tr("agent.up.tooBig", { name: f.name }); continue; }
      if (next.length >= MAX_FILES) { problem = tr("agent.up.tooMany", { n: MAX_FILES }); break; }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next); setErr(problem);
    if (input.current) input.current.value = "";
  };

  const send = (msg: string) => {
    const t = msg.trim();
    if (pending || busy) return;
    if (!t) { if (files.length) setErr(tr("agent.up.needText")); return; }
    setErr(null);
    start(async () => {
      const sent: AgentFile[] = [];
      if (files.length) {
        setBusy(true);
        const sb = createClient();
        for (const f of files) {
          let meta = stored.current.get(f);
          if (!meta) {
            const path = `${companyId}/agent/${crypto.randomUUID()}/${safeKey(f.name)}`;
            const { error } = await sb.storage.from("company-files").upload(path, f, { contentType: f.type || undefined, upsert: false });
            if (error) { setBusy(false); setErr(tr("agent.up.failed", { name: f.name })); return; }
            meta = { path, name: f.name, size: f.size, type: f.type };
            stored.current.set(f, meta);
          }
          sent.push(meta);
        }
        setBusy(false);
      }
      const r = await sendToAgent(companyId, "answer_question", tt, id, t, sent);
      if (r.ok) { setText(""); setFiles([]); stored.current.clear(); } else setErr(r.message);
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
          {(isCompany ? SUGGEST_COMPANY : SUGGEST_ITEM).map((s) => <button key={s} type="button" className="btn ghost sm" disabled={pending || busy} onClick={() => send(tr(s))}>{tr(s)}</button>)}
        </div>
      </div>
      {err && <p role="alert" className="err">{err}</p>}
      {files.length > 0 && (
        <ul className="dock-files" aria-label={tr("agent.up.files")}>
          {files.map((f) => (
            <li key={`${f.name}-${f.size}`} className="dock-file">
              <span className="dock-file-name"><bdi className="ltr">{f.name}</bdi></span><small className="ltr">{kb(f.size)}</small>
              <button type="button" className="dock-file-x" aria-label={tr("agent.up.remove", { name: f.name })} disabled={pending || busy} onClick={() => setFiles(files.filter((x) => x !== f))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {busy && <p role="status" className="muted">{tr("agent.up.sending")}</p>}
      <div className="dock-row">
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr" tabIndex={-1} aria-hidden="true" onChange={(e) => pick(e.target.files)} />
        <button type="button" className="dock-clip" title={tr("agent.up.hint", { n: MAX_FILES })} aria-label={tr("agent.up.btn")} disabled={pending || busy || files.length >= MAX_FILES} onClick={() => input.current?.click()}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.9-8.9a3.3 3.3 0 0 1 4.7 4.7l-8.9 8.9a1.7 1.7 0 0 1-2.4-2.4l8.2-8.2" /></svg>
        </button>
        <textarea rows={1} maxLength={2000} value={text} placeholder={tr("agent.dock.ph")} title={tr("agent.dock.title")} aria-label={tr("agent.dock.msgAria")}
          onChange={(e) => { setText(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        <button type="button" className="btn gold dock-send" disabled={pending || busy || !text.trim()} onClick={() => send(text)}>{pending || busy ? "…" : tr("agent.dock.send")}</button>
      </div>
      <small className="muted dock-hint">{tr("agent.up.hint", { n: MAX_FILES })}</small>
    </div>
  );
}
