"use client";
import { useState, useTransition } from "react";
import { markDraftSent, saveDraftEdit } from "@/app/inbox/actions";
import Menu from "@/components/Menu";

type Draft = { id: string; subject: string | null; body: string; to: string | null; status: string; warnings: string[] };

function Copy({ text, label, wide }: { text: string; label: string; wide?: boolean }) {
  const [done, setDone] = useState(false);
  return <button type="button" className={`btn sm ${wide ? "" : "ghost"}`} onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? "تم النسخ" : label}</button>;
}

export default function DraftPanel({ draft }: { draft: Draft }) {
  const [body, setBody] = useState(draft.body);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const closed = draft.status !== "draft";
  const changed = body !== draft.body;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.message ?? "حدث خطأ"); setConfirm(false); });

  return (
    <div className="draft">
      <dl className="meta ltr">
        <div><dt>To</dt><dd>{draft.to ?? "—"}</dd></div>
        <div><dt>Subject</dt><dd>{draft.subject ?? "—"}</dd></div>
      </dl>
      {draft.warnings.length > 0 && <ul className="warns">{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
      <label className="sr" htmlFor="draft-body">نص المسودة</label>
      <textarea id="draft-body" className="ltr" rows={9} value={body} readOnly={closed} onChange={(e) => setBody(e.target.value)} />
      {msg && <p role="alert" className="err">{msg}</p>}
      {closed ? <p className="muted">{draft.status === "approved" ? "سُجّل أنك أرسلتَ هذا الرد." : "هذه المسودة أُغلقت."}</p> : (
        <div className="row">
          <Copy text={body} label="نسخ النص" wide />
          <Menu label="نسخ آخر"><Copy text={draft.to ?? ""} label="نسخ العنوان" /><Copy text={draft.subject ?? ""} label="نسخ الموضوع" /></Menu>
          <span className="grow" />
          {changed && <button type="button" className="btn gold" disabled={pending} onClick={() => run(() => saveDraftEdit(draft.id, body))}>حفظ تعديلي</button>}
          {!confirm
            ? <button type="button" className={`btn ${changed ? "" : "gold"}`} disabled={pending || changed} onClick={() => setConfirm(true)}>أرسلتُه من بريدي</button>
            : <button type="button" className="btn gold" disabled={pending} onClick={() => run(() => markDraftSent(draft.id))}>تأكيد: أرسلتُه فعلاً</button>}
        </div>
      )}
      {!closed && changed && <p className="muted">احفظ تعديلك أولاً. يُسجَّل الفرق بين الصياغة الأصلية وتعديلك.</p>}
      {!closed && <p className="muted">SKYEYE لا يرسل شيئاً. أرسل الرد من بريد الشركة، ثم سجّل ذلك هنا.</p>}
    </div>
  );
}
