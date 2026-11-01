"use client";
import { useState, useTransition } from "react";
import { correctStep, recordStep } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import { TRACK_AR } from "@/lib/flight-labels";
import type { StepRow } from "@/lib/flights";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

export default function FlightTimeline({ steps, arrivalLeg, canAct }: { steps: StepRow[]; arrivalLeg: string; canAct: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [at, setAt] = useState("");
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tracks = [...new Set(steps.map((s) => s.track))];
  const key = (s: StepRow) => `${s.track}-${s.code}`;
  const save = (s: StepRow) => start(async () => {
    const r = s.state === "recorded" && s.eventId ? await correctStep(s.eventId, at, why) : await recordStep(arrivalLeg, s.code, at, "");
    setMsg(r.ok ? null : r.message); if (r.ok) { setEdit(null); setAt(""); setWhy(""); }
  });
  return (
    <div>
      {msg && <p role="alert" className="err">{msg}</p>}
      {tracks.map((t) => {
        const rows = steps.filter((s) => s.track === t);
        const done = rows.filter((s) => s.state === "recorded").length;
        return (
          <details key={t} className="track" open={rows.some((s) => s.state === "open")}>
            <summary><b>{TRACK_AR[t] ?? t}</b><small className="muted"> {done} من {rows.length}</small></summary>
            <ol className="timeline">
              {rows.map((s) => (
                <li key={key(s)}>
                  <i className={`dot ${s.state === "recorded" ? "ok" : s.state === "open" ? "warn" : "info"}`} />
                  <div>
                    <b>{s.nameAr}{s.isCritical ? " ★" : ""}</b>
                    <small className="muted"><span className="ltr">{s.code}</span>{s.plannedAt ? <> · المخطط <span className="ltr">{hm(s.plannedAt)}</span></> : ""}
                      {s.state === "recorded" ? <> · الفعلي <span className="ltr">{fmtUtc(s.actualAt)}</span>{s.variance !== null ? <> (<span className="ltr">{s.variance > 0 ? "+" : ""}{s.variance}</span> د)</> : ""}{s.wasCorrected ? " · مصحَّح" : ""}</> : s.state === "open" ? " · الوكيل ينتظر ردك" : " · لم يُسجَّل"}
                      {s.templateStatus !== "approved" && " · قالب بانتظار الاعتماد"}</small>
                    {canAct && edit === key(s) && (
                      <div className="row">
                        <input className="ltr" type="datetime-local" aria-label="الوقت (UTC)" value={at} onChange={(e) => setAt(e.target.value)} />
                        {s.state === "recorded" && <input aria-label="سبب التصحيح" placeholder="سبب التصحيح" value={why} onChange={(e) => setWhy(e.target.value)} />}
                        <button type="button" className="btn sm gold" disabled={pending || !at || (s.state === "recorded" && why.trim().length < 3)} onClick={() => save(s)}>{s.state === "recorded" ? "حفظ التصحيح" : "سجّل"}</button>
                        <button type="button" className="btn ghost sm" onClick={() => setEdit(null)}>رجوع</button>
                      </div>
                    )}
                    {canAct && edit !== key(s) && <button type="button" className="btn ghost sm" onClick={() => { setEdit(key(s)); setAt(""); setWhy(""); }}>{s.state === "recorded" ? "صحّح الوقت" : "سجّل الوقت"}</button>}
                  </div>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
