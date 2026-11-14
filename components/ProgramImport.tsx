"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { previewProgram, commitProgram } from "@/app/flights/import/actions";
import type { ProgramResult } from "@/lib/program";
import { labelOf } from "@/lib/i18n";
import { readProgramFile, FILE_ACCEPT } from "@/lib/program-file";
import { useT } from "@/components/I18n";

const TEMPLATE = "fn,stn,origin,dest,date,sta,std,dep,block_min,reg\nMS777/8,CAI,DXB,DXB,2026-11-01,14:00,15:30,,240,SU-GDM\n";
const SOFT = new Set(["airline_missing", "station_missing"]);

export default function ProgramImport({ canAdmin }: { canAdmin: boolean }) {
  const { t: tr, lang } = useT();
  const [text, setText] = useState(""); const [res, setRes] = useState<ProgramResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [note, setNote] = useState<string | null>(null); const [reading, setReading] = useState(false); const [addMissing, setAddMissing] = useState(false);
  const [pending, start] = useTransition();

  const reset = (t: string) => { setText(t); setRes(null); setMsg(null); setNote(null); };
  const onFile = async (input: HTMLInputElement) => {
    const f = input.files?.[0]; if (!f) return;
    setReading(true); setMsg(null); setNote(null); setRes(null);
    const r = await readProgramFile(f);
    setReading(false); input.value = "";
    if (!r.ok) { setMsg(tr(`imp.f.${r.reason}`, { name: f.name })); return; }
    setText(r.text);
    const notes: string[] = [];
    if (r.sheet) notes.push(tr("imp.f.sheet", { sheet: r.sheet }));
    if (!r.headerFound) notes.push(tr("imp.f.noHeader"));
    else if (r.kind === "pdf") notes.push(tr("imp.f.pdfCheck"));
    setNote(notes.length ? notes.join(" ") : null);
  };
  const preview = () => start(async () => { const r = await previewProgram(text); if (!r.ok) { setMsg(r.message); setRes(null); } else { setMsg(null); setRes(r.data); } });
  const commit = () => start(async () => { const r = await commitProgram(text, addMissing); if (!r.ok) { setMsg(r.message); return; } setRes(r.data); setMsg(null); });
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" })); a.download = "flight-program-template.csv"; a.click(); };

  const blocking = res ? res.rows.filter((r) => r.errors.some((e) => !(addMissing && SOFT.has(e)))).length : 0;
  const hasMissing = !!res && (res.missing_airlines.length > 0 || res.missing_stations.length > 0);
  const done = res?.committed ? res : null;

  return (
    <div className="stack">
      {!done && (<>
        <p className="muted">{tr("imp.intro1")} <span className="ltr">UTC</span>{tr("imp.intro2")} <span className="ltr">2026-11-01</span> {tr("imp.intro3")}</p>
        <div className="row">
          <button type="button" className="btn sm" onClick={download}>{tr("imp.template")}</button>
          <label className="btn sm" htmlFor="pf">{tr("imp.upload")}</label>
          <input id="pf" type="file" accept={FILE_ACCEPT} className="sr" onChange={(e) => onFile(e.currentTarget)} />
        </div>
        <label htmlFor="pt">{tr("imp.programLabel")}</label>
        <textarea id="pt" className="ltr" rows={9} dir="ltr" value={text} onChange={(e) => reset(e.target.value)} placeholder={TEMPLATE} />
        {reading && <p className="muted" role="status">{tr("imp.f.reading")}</p>}
        {note && <p className="muted" role="status">{note}</p>}
        {msg && <p role="alert" className="err">{msg}</p>}
        <div className="row"><button type="button" className="btn gold" disabled={pending || reading || text.trim().length < 5} onClick={preview}>{pending && !res ? tr("imp.checking") : tr("imp.check")}</button></div>
      </>)}

      {res && !done && (
        <div className="stack">
          <div className="chips">
            <span className="tag info">{tr("imp.rows")} <span className="ltr">{res.total}</span></span>
            <span className={`tag ${blocking ? "late" : "ok"}`}>{blocking ? <>{tr("imp.hasErrors")} <span className="ltr">{blocking}</span></> : tr("imp.clean")}</span>
          </div>
          {hasMissing && (
            <div className="card glass">
              <b>{tr("imp.missing.title")}</b>
              {res.missing_airlines.length > 0 && <small className="muted">{tr("imp.missing.airlines")} <span className="ltr">{res.missing_airlines.join(" ")}</span></small>}
              {res.missing_stations.length > 0 && <small className="muted">{tr("imp.missing.stations")} <span className="ltr">{res.missing_stations.join(" ")}</span></small>}
              {canAdmin
                ? <label className="inline"><input type="checkbox" checked={addMissing} onChange={(e) => setAddMissing(e.target.checked)} /> {tr("imp.addMissing")}</label>
                : <small className="muted">{tr("imp.adminOnly")}</small>}
            </div>
          )}
          <ul className="list">
            {res.rows.map((r) => {
              const bad = r.errors.filter((e) => !(addMissing && SOFT.has(e)));
              return (
                <li key={r.i}>
                  <i className={`dot ${bad.length ? "late" : r.warnings.length ? "warn" : "ok"}`} />
                  <span>
                    <b className="ltr">{r.fn || "—"}</b> <small className="muted"><span className="ltr">{r.origin}→{r.stn}→{r.dest} · {r.date} · {r.sta}→{r.std}{r.reg ? ` · ${r.reg}` : ""}</span></small>
                    {r.errors.map((e) => <small key={e} className={SOFT.has(e) && addMissing ? "muted" : "err"}>{labelOf(lang, "imp.err", e)}{SOFT.has(e) && addMissing ? tr("imp.willAdd") : ""}</small>)}
                    {r.warnings.map((w) => <small key={w} className="muted">{labelOf(lang, "imp.warn", w)}</small>)}
                  </span>
                </li>
              );
            })}
          </ul>
          {msg && <p role="alert" className="err">{msg}</p>}
          <div className="row">
            <button type="button" className="btn gold" disabled={pending || blocking > 0} onClick={commit}>{pending ? tr("imp.saving") : tr("imp.commit")}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => setRes(null)}>{tr("imp.edit")}</button>
          </div>
          {blocking > 0 && <small className="muted">{tr("imp.blockNote")}</small>}
        </div>
      )}

      {done && (
        <div className="stack">
          <p className="ok">{tr("imp.done")}</p>
          <div className="chips">
            <span className="tag ok">{tr("imp.r.rotations")} <span className="ltr">{done.result?.rows ?? 0}</span></span>
            <span className="tag ok">{tr("imp.r.new")} <span className="ltr">{done.result?.flights_inserted ?? 0}</span></span>
            <span className="tag info">{tr("imp.r.skipped")} <span className="ltr">{done.result?.flights_skipped_existing ?? 0}</span></span>
            {(done.airlines_added ?? 0) > 0 && <span className="tag info">{tr("imp.r.airlines")} <span className="ltr">{done.airlines_added}</span></span>}
            {(done.stations_added ?? 0) > 0 && <span className="tag info">{tr("imp.r.stations")} <span className="ltr">{done.stations_added}</span></span>}
          </div>
          <div className="row"><Link className="btn gold" href="/flights">{tr("imp.openFlights")}</Link><button type="button" className="btn" onClick={() => { reset(""); }}>{tr("imp.another")}</button></div>
        </div>
      )}
    </div>
  );
}
