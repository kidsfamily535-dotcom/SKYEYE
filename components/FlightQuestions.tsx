"use client";
import { useState, useTransition } from "react";
import { answerCheckin } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import type { Question } from "@/lib/flights";

/** The agent's questions. "Yes" needs the real time typed by the employee: no time is ever guessed. */
export default function FlightQuestions({ questions, canAct }: { questions: Question[]; canAct: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [at, setAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (id: string, a: "yes" | "not_yet" | "not_applicable") => start(async () => {
    const r = await answerCheckin(id, a, at, ""); setMsg(r.ok ? null : r.message); if (r.ok) { setOpenId(null); setAt(""); }
  });
  if (questions.length === 0) return <p className="muted">لا توجد أسئلة مفتوحة من الوكيل الآن.</p>;
  return (
    <ul className="list">
      {msg && <li role="alert" className="err">{msg}</li>}
      {questions.map((q) => (
        <li key={q.id} className="qrow">
          <i className={`dot ${q.status === "late" || q.status === "escalated" ? "late" : "warn"}`} />
          <span><b>{q.text}</b><small className="muted"><span className="ltr">{q.step}</span> · الموعد <span className="ltr">{fmtUtc(q.dueAt)}</span>{q.status === "late" ? " · متأخر" : ""}{q.status === "in_progress" ? " · قلتَ «لسه»" : ""}</small></span>
          {canAct && (openId === q.id
            ? <div className="row"><label className="muted" htmlFor={`t-${q.id}`}>الوقت الفعلي (UTC)</label><input id={`t-${q.id}`} className="ltr" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
                <button type="button" className="btn sm gold" disabled={pending || !at} onClick={() => send(q.id, "yes")}>سجّل</button><button type="button" className="btn ghost sm" onClick={() => setOpenId(null)}>رجوع</button></div>
            : <div className="row"><button type="button" className="btn sm" onClick={() => { setOpenId(q.id); setAt(""); }}>تم</button><button type="button" className="btn ghost sm" disabled={pending} onClick={() => send(q.id, "not_yet")}>لسه</button><button type="button" className="btn ghost sm" disabled={pending} onClick={() => send(q.id, "not_applicable")}>لا ينطبق</button></div>)}
        </li>
      ))}
    </ul>
  );
}
