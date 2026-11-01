"use client";
import { useState, useTransition } from "react";
import { stateDelay } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import type { DelayCode, Statement, StepRow } from "@/lib/flights";

/** The employee states the reason. SKYEYE never proposes one (fixed rule 7). */
export default function DelayForm({ flightId, steps, codes, statements, canAct }: { flightId: string; steps: StepRow[]; codes: DelayCode[]; statements: Statement[]; canAct: boolean }) {
  const [step, setStep] = useState(""); const [code, setCode] = useState(""); const [mins, setMins] = useState(""); const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null); const [pending, start] = useTransition();
  const submit = () => start(async () => { const r = await stateDelay(flightId, step, code, mins, reason); setMsg(r.ok ? null : r.message); if (r.ok) { setReason(""); setMins(""); setStep(""); setCode(""); } });
  return (
    <div>
      {statements.length === 0 && <p className="muted">لا توجد إفادات تأخير. إن حدث تأخير اكتب سببه هنا، وشركة الطيران تقارنه بالأوقات الفعلية.</p>}
      <ul className="list">{statements.map((s) => (
        <li key={s.id}><span><bdi>{s.reason}</bdi><small className="muted">{s.step && <span className="ltr">{s.step} · </span>}{s.minutes !== null && <span className="ltr">{s.minutes}m · </span>}{s.code && <span className="ltr">{s.code} · </span>}{s.by ?? "—"} · <span className="ltr">{fmtUtc(s.at)}</span></small></span></li>
      ))}</ul>
      {canAct && (
        <div className="stack">
          {msg && <p role="alert" className="err">{msg}</p>}
          <label htmlFor="d-step">المرحلة المتأخرة (اختياري)</label>
          <select id="d-step" value={step} onChange={(e) => setStep(e.target.value)}><option value="">—</option>{steps.map((s) => <option key={`${s.track}-${s.code}`} value={s.code}>{s.nameAr}</option>)}</select>
          <label htmlFor="d-code">كود التأخير (اختياري)</label>
          <select id="d-code" className="ltr" value={code} onChange={(e) => setCode(e.target.value)}><option value="">—</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <label htmlFor="d-min">الدقائق (اختياري)</label>
          <input id="d-min" className="ltr" inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} />
          <label htmlFor="d-why">السبب بكلماتك</label>
          <textarea id="d-why" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className="btn gold" disabled={pending || reason.trim().length < 3} onClick={submit}>سجّل الإفادة</button>
        </div>
      )}
    </div>
  );
}
