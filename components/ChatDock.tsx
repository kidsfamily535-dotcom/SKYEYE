"use client";
import { useState, useTransition } from "react";
import { sendToAgent } from "@/app/agent/actions";
import type { Opt } from "@/lib/agent-labels";

type Opts = { email: Opt[]; draft: Opt[]; request: Opt[]; flight: Opt[] };
const SUGGEST_COMPANY = ["إيه اللي عندي النهاردة؟", "إيه اللي محتاج انتباه دلوقتي؟", "في رحلات متأخرة؟", "كام إيميل لسه ما اتراجعش؟"];
const SUGGEST_ITEM = ["لخّصلي الوضع", "إيه اللي ناقص؟", "إيه الخطوة الجاية؟"];

export default function ChatDock({ companyId, opts, initial, canWrite }: { companyId: string; opts: Opts; initial: { type: string; id: string } | null; canWrite: boolean }) {
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

  if (!canWrite) return <p className="muted dock-note">صلاحية المشاهدة تسمح بقراءة المحادثة فقط.</p>;
  return (
    <div className="dock">
      <div className="dock-top">
        <label className="dock-ctx"><span className="muted">أسأل عن</span>
          <select className="pick" value={ctx} onChange={(e) => setCtx(e.target.value)} aria-label="موضوع السؤال">
            <option value={`company:${companyId}`}>الشركة كلها (سؤال عام)</option>
            {opts.flight.length > 0 && <optgroup label="رحلة">{opts.flight.map((o) => <option key={o.id} value={`flight:${o.id}`}>{o.label}</option>)}</optgroup>}
            {opts.request.length > 0 && <optgroup label="ملف طلب">{opts.request.map((o) => <option key={o.id} value={`request_file:${o.id}`}>{o.label}</option>)}</optgroup>}
            {opts.email.length > 0 && <optgroup label="إيميل">{opts.email.map((o) => <option key={o.id} value={`email_message:${o.id}`}>{o.label}</option>)}</optgroup>}
            {opts.draft.length > 0 && <optgroup label="مسودة رد">{opts.draft.map((o) => <option key={o.id} value={`reply_draft:${o.id}`}>{o.label}</option>)}</optgroup>}
          </select>
        </label>
        <div className="sugg" aria-label="اقتراحات">
          {(isCompany ? SUGGEST_COMPANY : SUGGEST_ITEM).map((s) => <button key={s} type="button" className="btn ghost sm" disabled={pending} onClick={() => send(s)}>{s}</button>)}
        </div>
      </div>
      {err && <p role="alert" className="err">{err}</p>}
      <div className="dock-row">
        <textarea rows={1} maxLength={2000} value={text} placeholder="اكتب للوكيل…" title="Enter للإرسال، Shift+Enter لسطر جديد" aria-label="رسالتك للوكيل"
          onChange={(e) => { setText(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        <button type="button" className="btn gold" disabled={pending || !text.trim()} onClick={() => send(text)}>{pending ? "…" : "أرسل"}</button>
      </div>
    </div>
  );
}
