"use client";
import { useState, useTransition } from "react";
import { composeFlightMessage, type Composed } from "@/app/flights/actions";
import type { MessageType } from "@/lib/flights";

/** Actions: every message type the system can build. It fills what it knows; the employee completes the actual times. Drafts only: nothing is sent. */
export default function FlightActions({ companyId, types, legs, canAct }: { companyId: string; types: MessageType[]; legs: { id: string; label: string }[]; canAct: boolean }) {
  const [open, setOpen] = useState(false); const [type, setType] = useState<string | null>(null); const [leg, setLeg] = useState(legs[legs.length - 1]?.id ?? "");
  const [vals, setVals] = useState<Record<string, string>>({}); const [res, setRes] = useState<Composed | null>(null); const [copied, setCopied] = useState(false); const [pending, start] = useTransition();
  const run = (t: string, v: Record<string, string>) => start(async () => { setCopied(false); setRes(await composeFlightMessage(companyId, t, leg, v)); });
  if (!canAct) return null;
  return (
    <div className="card">
      <div className="row"><h2>Actions</h2><button type="button" className="btn sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "إغلاق" : "قائمة الرسائل"}</button></div>
      {open && <>
        <p className="muted">النظام يبني الرسالة مما يعرفه، وأنت تكمل الأوقات الفعلية. هذه مسودة فقط: انسخها وأرسلها من بريد الشركة.</p>
        <fieldset className="row"><legend className="muted">الرسالة تخص</legend>{legs.map((l) => <label key={l.id}><input type="radio" name="leg" checked={leg === l.id} onChange={() => { setLeg(l.id); setRes(null); }} /> <span className="ltr">{l.label}</span></label>)}</fieldset>
        <div className="chips">{types.map((m) => <button key={m.type} type="button" disabled={!m.composable} title={m.composable ? (m.title ?? "") : "الصيغة موجودة لكنها لم تُفعَّل للبناء الآلي بعد"} className={`btn sm ${type === m.type ? "gold" : "ghost"}`} onClick={() => { setType(m.type); setVals({}); setRes(null); run(m.type, {}); }}><span className="ltr">{m.type}</span></button>)}</div>
        <p className="muted">الرسائل الباهتة صيغتها محفوظة لكن بناؤها الآلي غير مفعّل بعد.</p>
        {types.length === 0 && <p className="muted">لا توجد صيغ رسائل قابلة للبناء.</p>}
        {pending && <p className="muted">جارٍ البناء…</p>}
        {res?.status === "error" && <p role="alert" className="err">{res.message}</p>}
        {res?.status === "missing" && (
          <div className="stack">
            <p>أكمل هذه البيانات (لا يخترع الوكيل قيمة ناقصة):</p>
            {res.missing.map((f) => <div key={f.field}><label htmlFor={`f-${f.field}`}>{f.label}</label><input id={`f-${f.field}`} className="ltr" placeholder={f.format} value={vals[f.field] ?? ""} onChange={(e) => setVals({ ...vals, [f.field]: e.target.value })} /></div>)}
            <button type="button" className="btn gold" disabled={pending || !type} onClick={() => type && run(type, vals)}>ابنِ الرسالة</button>
          </div>
        )}
        {res?.status === "ok" && (
          <div className="draft">
            <pre className="ltr mono">{res.draft}</pre>
            {res.warnings.map((w, i) => <p key={i} className="muted ltr">⚠ {w}</p>)}
            {res.deviations.map((w, i) => <p key={i} className="err ltr">{w}</p>)}
            <button type="button" className="btn sm gold" onClick={async () => { await navigator.clipboard.writeText(res.draft); setCopied(true); }}>{copied ? "تم النسخ" : "نسخ الرسالة"}</button>
          </div>
        )}
      </>}
    </div>
  );
}
