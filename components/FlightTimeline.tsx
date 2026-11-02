"use client";
import { useState, useTransition } from "react";
import { correctStep, recordStep } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import { labelOf } from "@/lib/i18n";
import { stepName } from "@/lib/step-name";
import type { StepRow } from "@/lib/flights";
import { useT } from "@/components/I18n";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

export default function FlightTimeline({ steps, arrivalLeg, canAct }: { steps: StepRow[]; arrivalLeg: string; canAct: boolean }) {
  const { t: tr, lang } = useT();
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
            <summary><b>{labelOf(lang, "track", t)}</b><small className="muted"> {tr("fl.tl.count", { done, total: rows.length })}</small></summary>
            <ol className="timeline">
              {rows.map((s) => (
                <li key={key(s)}>
                  <i className={`dot ${s.state === "recorded" ? "ok" : s.state === "open" ? "warn" : "info"}`} />
                  <div>
                    <b>{stepName(s, lang)}{s.isCritical ? " ★" : ""}</b>
                    <small className="muted"><span className="ltr">{s.code}</span>{s.plannedAt ? <> · {tr("fl.tl.planned")} <span className="ltr">{hm(s.plannedAt)}</span></> : ""}
                      {s.state === "recorded" ? <> · {tr("fl.tl.actual")} <span className="ltr">{fmtUtc(s.actualAt)}</span>{s.variance !== null ? <> (<span className="ltr">{s.variance > 0 ? "+" : ""}{tr("fl.min", { n: s.variance })}</span>)</> : ""}{s.wasCorrected ? ` · ${tr("fl.tl.corrected")}` : ""}</> : s.state === "open" ? ` · ${tr("fl.tl.waiting")}` : ` · ${tr("fl.tl.notRec")}`}
                      {s.templateStatus !== "approved" && ` · ${tr("fl.tl.tplPending")}`}</small>
                    {canAct && edit === key(s) && (
                      <div className="row">
                        <input className="ltr" type="datetime-local" aria-label={tr("fl.tl.timeAria")} value={at} onChange={(e) => setAt(e.target.value)} />
                        {s.state === "recorded" && <input aria-label={tr("fl.tl.why")} placeholder={tr("fl.tl.why")} value={why} onChange={(e) => setWhy(e.target.value)} />}
                        <button type="button" className="btn sm gold" disabled={pending || !at || (s.state === "recorded" && why.trim().length < 3)} onClick={() => save(s)}>{s.state === "recorded" ? tr("fl.tl.saveFix") : tr("fl.tl.record")}</button>
                        <button type="button" className="btn ghost sm" onClick={() => setEdit(null)}>{tr("fl.tl.back")}</button>
                      </div>
                    )}
                    {canAct && edit !== key(s) && <button type="button" className={`btn sm ${s.state === "open" ? "gold" : "ghost"}`} onClick={() => { setEdit(key(s)); setAt(""); setWhy(""); }}>{s.state === "recorded" ? tr("fl.tl.fixTime") : tr("fl.tl.recTime")}</button>}
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
