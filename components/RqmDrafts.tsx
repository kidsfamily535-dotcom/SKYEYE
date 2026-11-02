"use client";
import { useState, useTransition } from "react";
import { markMessageSent, rejectMessageDraft } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import type { FlightRqm } from "@/lib/flights";

/** RQM drafts SKYEYE prepared on its own. The employee copies, sends from the company mailbox, then records it here. */
export default function RqmDrafts({ drafts, canAct }: { drafts: FlightRqm[]; canAct: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.message ?? "حدث خطأ"); setConfirm(null); });
  if (drafts.length === 0) return null;
  return (
    <div className="card" id="rqm">
      <h2>استفسار عن المغادرة (RQM)<Hint>جهّزه الوكيل لأن رسالة المغادرة (AD) لم تصل بعد انقضاء 15 دقيقة. لا يُرسَل شيء: انسخه وأرسله من بريد الشركة ثم سجّل ذلك هنا. بعد 15 دقيقة من تسجيل الإرسال دون رد يجهّز الوكيل مسودة متابعة واحدة.</Hint></h2>
      {drafts.map((d) => {
        const sent = !!d.sentAt;
        return (
          <div key={d.id} className="draft">
            <small className="muted">{d.followup ? "مسودة متابعة · " : ""}{sent ? <>أُرسلت <span className="ltr">{fmtUtc(d.sentAt)}</span> · بانتظار الرد</> : <>جاهزة منذ <span className="ltr">{fmtUtc(d.createdAt)}</span></>}</small>
            <pre className="ltr mono orig">{d.body}</pre>
            {d.warnings.map((w, i) => <p key={i} className="muted">⚠ {w}</p>)}
            {!sent && canAct && (
              <div className="row">
                <button type="button" className="btn sm" onClick={async () => { await navigator.clipboard.writeText(d.body); setCopied(d.id); setTimeout(() => setCopied(null), 1500); }}>{copied === d.id ? "تم النسخ" : "نسخ الرسالة"}</button>
                <span className="grow" />
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => rejectMessageDraft(d.id))}>غير مطلوبة</button>
                {confirm === d.id
                  ? <button type="button" className="btn gold" disabled={pending} onClick={() => run(() => markMessageSent(d.id))}>تأكيد: أرسلتُها فعلاً</button>
                  : <button type="button" className="btn gold" disabled={pending} onClick={() => setConfirm(d.id)}>أرسلتُها من بريدي</button>}
              </div>
            )}
          </div>
        );
      })}
      {msg && <p role="alert" className="muted">{msg}</p>}
    </div>
  );
}
