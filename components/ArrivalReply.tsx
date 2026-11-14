"use client";
import { useState, useTransition } from "react";
import { recordStep } from "@/app/flights/actions";

type Labels = { q: string; yes: string; useNow: string; save: string; back: string; timeAria: string };

/** The agent's one question at the top of the flight file: "did it arrive?". "Yes" records ON_BLOCK on the arrival leg through the same action the handling timeline uses. The employee types the time; no time is ever guessed. */
export default function ArrivalReply({ arrivalLeg, text, canAct, L }: { arrivalLeg: string; text: string; canAct: boolean; L: Labels }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await recordStep(arrivalLeg, "ON_BLOCK", at, ""); setMsg(r.ok ? null : r.message); if (r.ok) { setOpen(false); setAt(""); } });
  return (
    <div className="fx-agent">
      <p><span>{text}</span> <b>{L.q}</b></p>
      {canAct && !open && <div className="fx-reply"><button type="button" className="btn gold" onClick={() => setOpen(true)}>{L.yes}</button></div>}
      {canAct && open && (
        <div className="fx-reply">
          <input className="ltr pick" type="datetime-local" aria-label={L.timeAria} value={at} onChange={(e) => setAt(e.target.value)} />
          <button type="button" className="btn sm" onClick={() => setAt(new Date().toISOString().slice(0, 16))}>{L.useNow}</button>
          <button type="button" className="btn gold" disabled={pending || !at} onClick={save}>{L.save}</button>
          <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>{L.back}</button>
        </div>
      )}
      {msg && <p role="alert" className="err">{msg}</p>}
    </div>
  );
}
