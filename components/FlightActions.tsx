"use client";
import { useState, useTransition } from "react";
import { composeFlightMessage, type Composed } from "@/app/flights/actions";
import Hint from "@/components/Hint";
import { useT } from "@/components/I18n";
import type { MessageType } from "@/lib/flights";

/** الترتيب المعتمد للقائمة. الساق تُستنتج من نوع الرسالة (وصف الصيغ في القاعدة): AA للوصول، وAD وED وNI للمغادرة، وRQM يخص الرحلة القادمة (يُطلب من محطة الإقلاع الأصلية). */
const ORDER: { type: string; label: string; leg: 0 | 1 }[] = [
  { type: "RQM", label: "RQM MVT", leg: 0 },
  { type: "MVT-AA", label: "AA MVT", leg: 0 },
  { type: "MVT-ED", label: "ED", leg: 1 },
  { type: "MVT-NI", label: "NI", leg: 1 },
  { type: "MVT-AD", label: "AD MVT", leg: 1 },
];

/** Actions: every message type the system can build. It fills what it knows; the employee completes the actual times. Drafts only: nothing is sent. */
export default function FlightActions({ companyId, types, legs, canAct }: { companyId: string; types: MessageType[]; legs: { id: string; label: string }[]; canAct: boolean }) {
  const { t: tr } = useT();
  const [type, setType] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({}); const [res, setRes] = useState<Composed | null>(null); const [copied, setCopied] = useState(false); const [pending, start] = useTransition();
  const ready = ORDER.filter((o) => types.some((m) => m.type === o.type && m.composable) && legs[o.leg]);
  const legOf = (t: string) => legs[ORDER.find((o) => o.type === t)?.leg ?? 1]?.id ?? "";
  const run = (t: string, v: Record<string, string>) => start(async () => { setCopied(false); setRes(await composeFlightMessage(companyId, t, legOf(t), v)); });
  if (!canAct) return null;
  return (
    <div className="card">
      <h2>{tr("fl.act.title")}<Hint>{tr("fl.act.hint")}</Hint></h2>
      {ready.length === 0 ? <p className="muted">{tr("fl.act.none")}</p> : <>
        <div className="row">
          <label className="sr" htmlFor="msg-type">{tr("fl.act.typeLabel")}</label>
          <select id="msg-type" className="pick ltr" value={type ?? ""} onChange={(e) => { const t = e.target.value; setVals({}); setRes(null); if (!t) { setType(null); return; } setType(t); run(t, {}); }}>
            <option value="">{tr("fl.act.pick")}</option>
            {ready.map((o) => <option key={o.type} value={o.type}>{`${o.label} — ${legs[o.leg].label}`}</option>)}
          </select>
        </div>
      </>}
        {pending && <p className="muted">{tr("fl.act.building")}</p>}
        {res?.status === "error" && <p role="alert" className="err">{res.message}</p>}
        {res?.status === "missing" && (
          <div className="stack">
            <p>{tr("fl.act.fill")}</p>
            {res.missing.map((f) => <div key={f.field}><label htmlFor={`f-${f.field}`}>{f.label}</label><input id={`f-${f.field}`} className="ltr" placeholder={f.format} value={vals[f.field] ?? ""} onChange={(e) => setVals({ ...vals, [f.field]: e.target.value })} /></div>)}
            <button type="button" className="btn gold" disabled={pending || !type} onClick={() => type && run(type, vals)}>{tr("fl.act.build")}</button>
          </div>
        )}
        {res?.status === "ok" && (
          <div className="draft">
            <pre className="ltr mono">{res.draft}</pre>
            {res.warnings.map((w, i) => <p key={i} className="muted ltr">⚠ {w}</p>)}
            {res.deviations.map((w, i) => <p key={i} className="err ltr">{w}</p>)}
            <button type="button" className="btn sm gold" onClick={async () => { await navigator.clipboard.writeText(res.draft); setCopied(true); }}>{copied ? tr("copy.done") : tr("fl.act.copy")}</button>
          </div>
        )}
    </div>
  );
}
