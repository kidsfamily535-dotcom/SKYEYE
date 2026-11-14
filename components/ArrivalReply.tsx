"use client";
import { useState, useTransition } from "react";
import { recordStep } from "@/app/flights/actions";

type Labels = { q: string; yes: string; useNow: string; save: string; back: string; td: string; co: string; coHint: string; order: string };

const stamp = () => new Date().toISOString().slice(0, 16);

/** The agent's one question at the top of the flight file: "did it arrive?". Two real times exist: touchdown (event ATA, the one that flips the flight to "arrived") and chocks-on (ON_BLOCK, starts the stand time). Touchdown is required, chocks-on is optional (the aircraft may not be parked yet). The employee types the times; none is ever guessed. */
export default function ArrivalReply({ arrivalLeg, text, canAct, L }: { arrivalLeg: string; text: string; canAct: boolean; L: Labels }) {
  const [open, setOpen] = useState(false);
  const [td, setTd] = useState("");
  const [co, setCo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    if (co && co < td) { setMsg(L.order); return; }
    const a = await recordStep(arrivalLeg, "ATA", td, "");
    if (!a.ok) { setMsg(a.message); return; }
    if (co) { const b = await recordStep(arrivalLeg, "ON_BLOCK", co, ""); if (!b.ok) { setMsg(b.message); return; } }
    setMsg(null); setOpen(false); setTd(""); setCo("");
  });
  const field = (id: string, label: string, v: string, set: (x: string) => void, hint?: string) => (
    <div className="fx-fld">
      <label htmlFor={id}>{label}</label>
      <div className="fx-fld-row">
        <input id={id} className="ltr pick" type="datetime-local" value={v} onChange={(e) => set(e.target.value)} />
        <button type="button" className="btn sm" onClick={() => set(stamp())}>{L.useNow}</button>
      </div>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
  return (
    <div className="fx-agent">
      <p><span>{text}</span> <b>{L.q}</b></p>
      {canAct && !open && <div className="fx-reply"><button type="button" className="btn gold" onClick={() => setOpen(true)}>{L.yes}</button></div>}
      {canAct && open && (
        <div className="fx-reply col">
          <div className="fx-flds">
            {field("arr-td", L.td, td, setTd)}
            {field("arr-co", L.co, co, setCo, L.coHint)}
          </div>
          <div className="fx-reply">
            <button type="button" className="btn gold" disabled={pending || !td} onClick={save}>{L.save}</button>
            <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>{L.back}</button>
          </div>
        </div>
      )}
      {msg && <p role="alert" className="err">{msg}</p>}
    </div>
  );
}
