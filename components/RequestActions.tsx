"use client";
import { useState, useTransition } from "react";
import Hint from "@/components/Hint";
import { advanceRequest } from "@/app/requests/actions";

type Move = { to: string; label: string };

/** Manual moves only. "Closed" is never a button: it happens when the sent reply is recorded (email evidence). */
export default function RequestActions({ fileId, moves, canClose }: { fileId: string; moves: Move[]; canClose: boolean }) {
  const [pick, setPick] = useState<string | null>(null);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (to: string, note: string) => start(async () => { const r = await advanceRequest(fileId, to, note); setMsg(r.ok ? null : r.message); setPick(null); if (r.ok) { setCancel(false); setReason(""); } });
  const cancelMove = moves.find((m) => m.to === "cancelled");
  const forward = moves.filter((m) => m.to !== "cancelled" && m.to !== "closed");

  return (
    <div className="req-actions">
      {msg && <p role="alert" className="err">{msg}</p>}
      <div className="row">
        {forward.map((m) => pick === m.to
          ? <button key={m.to} type="button" className="btn gold" disabled={pending} onClick={() => run(m.to, "")}>تأكيد: {m.label}</button>
          : <button key={m.to} type="button" className="btn" disabled={pending} onClick={() => setPick(m.to)}>{m.label}</button>)}
        {forward.length === 0 && !canClose && <span className="muted">لا توجد خطوة يدوية الآن.</span>}
      </div>
      {canClose && <Hint>الإغلاق لا يتم بزر: يُغلق الطلب تلقائياً عندما تضغط «أرسلتُه من بريدي» على الرد الأخير داخل الوارد.</Hint>}
      {cancelMove && (!cancel
        ? <button type="button" className="btn danger sm" onClick={() => setCancel(true)}>إلغاء الطلب</button>
        : <div className="cancel-box">
            <label htmlFor="cancel-reason">سبب الإلغاء</label>
            <textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="row"><button type="button" className="btn sm danger solid" disabled={pending || !reason.trim()} onClick={() => run("cancelled", reason)}>تأكيد الإلغاء</button><button type="button" className="btn ghost sm" onClick={() => setCancel(false)}>رجوع</button></div>
          </div>)}
    </div>
  );
}
