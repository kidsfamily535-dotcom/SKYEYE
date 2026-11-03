"use client";
import { useMemo, useState, useTransition } from "react";
import { composeFlightMessage, type Composed } from "@/app/flights/actions";
import Hint from "@/components/Hint";
import { useT } from "@/components/I18n";
import type { DelayCode, NeededItem, PanelMessage, SpecField } from "@/lib/flights";

/** Fields the system fills from the flight itself (only for formats that look the flight up). */
const AUTO = new Set(["airline", "flight_number", "day", "registration", "station", "date"]);
/** Which leg a message is about when the employee has not chosen: 0 = arrival leg, 1 = departure leg. */
const ARRIVAL_SIDE = new Set(["RQM", "MVT-AA", "MVT-EB", "FR", "DIV"]);
const short = (t: string) => t.replace(/^MVT-/, "");
const looksJson = (f: SpecField) => /^\s*[\[{]/.test(f.format);

/** Employee-owned message composer: every GOM format in one drop-down. Built formats compose a saved draft; locked ones show greyed "under review". Nothing is sent. */
export default function MessageComposer({ companyId, messages, legs, delayCodes, needed, initialType, canAct }: {
  companyId: string; messages: PanelMessage[]; legs: { id: string; label: string }[]; delayCodes: DelayCode[]; needed: NeededItem[]; initialType?: string; canAct: boolean;
}) {
  const { t } = useT();
  const due = useMemo(() => needed.filter((x): x is Extract<NeededItem, { kind: "message_due" }> => x.kind === "message_due"), [needed]);
  const start = initialType && messages.some((m) => m.type === initialType && m.composable) ? initialType : "";
  const [type, setType] = useState(start);
  const [leg, setLeg] = useState(() => legIndex(start, due, legs));
  const [vals, setVals] = useState<Record<string, string>>(() => suggestFor(start, due));
  const [codes, setCodes] = useState<[string, string]>(["", ""]);
  const [extra, setExtra] = useState<SpecField[]>([]);
  const [res, setRes] = useState<Composed | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, run] = useTransition();
  const iata = useMemo(() => delayCodes.filter((c) => c.scheme === "IATA"), [delayCodes]);
  const msg = messages.find((m) => m.type === type);
  const ready = messages.filter((m) => m.composable); const locked = messages.filter((m) => !m.composable);
  const dueTypes = new Set(due.filter((d) => d.isDue).map((d) => d.type));

  function legIndex(ty: string, d: typeof due, l: typeof legs): number {
    const hit = d.find((x) => x.type === ty && x.forFlightId); const byDue = hit ? l.findIndex((x) => x.id === hit.forFlightId) : -1;
    return byDue >= 0 ? byDue : ARRIVAL_SIDE.has(ty) ? 0 : 1;
  }
  function suggestFor(ty: string, d: typeof due): Record<string, string> {
    const s = d.find((x) => x.type === ty)?.suggested; if (!s) return {};
    return ty === "MVT-ED" ? { ed: s } : ty === "MVT-NI" ? { ni: s } : {};
  }
  const pick = (ty: string) => { setType(ty); setLeg(legIndex(ty, due, legs)); setVals(suggestFor(ty, due)); setCodes(["", ""]); setExtra([]); setRes(null); setSaved(false); };

  const fields = (msg ? [...msg.required.map((f) => ({ f, req: true })), ...msg.optional.map((f) => ({ f, req: false }))] : [])
    .filter(({ f }) => !(msg?.flightLookup && AUTO.has(f.field)));
  const autoFields = msg?.flightLookup ? [...(msg?.required ?? []), ...(msg?.optional ?? [])].filter((f) => AUTO.has(f.field)) : [];

  const build = () => {
    if (!type || !legs[leg]) return;
    const data: Record<string, string> = { ...vals };
    const picked = codes.filter(Boolean); if (picked.length) data.delay = JSON.stringify({ codes: picked });
    run(async () => {
      setSaved(false);
      const r = await composeFlightMessage(companyId, type, legs[leg].id, data);
      setRes(r);
      if (r.status === "missing") setExtra(r.missing);
      if (r.status === "ok") { setSaved(true); setType(""); setVals({}); setCodes(["", ""]); setExtra([]); }
    });
  };

  const input = (f: SpecField, req: boolean) => (
    <div key={f.field}>
      <label htmlFor={`f-${f.field}`}>{f.label}{!req && <small className="muted"> ({t("fl.cmp.optional")})</small>}</label>
      {looksJson(f)
        ? <textarea id={`f-${f.field}`} className="ltr mono" rows={4} placeholder={f.format} value={vals[f.field] ?? ""} onChange={(e) => setVals({ ...vals, [f.field]: e.target.value })} />
        : <input id={`f-${f.field}`} className="ltr" placeholder={f.format} value={vals[f.field] ?? ""} onChange={(e) => setVals({ ...vals, [f.field]: e.target.value })} />}
    </div>
  );

  if (!canAct) return null;
  return (
    <div className="card">
      <h2>{t("fl.cmp.title")}<Hint>{t("fl.cmp.hint")}</Hint></h2>
      {messages.length === 0 ? <p className="muted">{t("fl.cmp.none")}</p> : <>
        <div className="row">
          <label className="sr" htmlFor="msg-type">{t("fl.cmp.typeLabel")}</label>
          <select id="msg-type" className="pick ltr" value={type} onChange={(e) => pick(e.target.value)}>
            <option value="">{t("fl.cmp.pick")}</option>
            <optgroup label={t("fl.cmp.groupReady")}>
              {[...ready].sort((a, b) => Number(dueTypes.has(b.type)) - Number(dueTypes.has(a.type))).map((m) => <option key={m.type} value={m.type}>{`${dueTypes.has(m.type) ? "● " : ""}${short(m.type)} — ${m.title ?? m.type}${dueTypes.has(m.type) ? ` · ${t("fl.cmp.suggested")}` : ""}`}</option>)}
            </optgroup>
            <optgroup label={t("fl.cmp.groupLocked")}>
              {locked.map((m) => <option key={m.type} value={m.type} disabled className="lockedopt">{`${short(m.type)} — ${m.title ?? m.type} · ${t("fl.cmp.locked")}`}</option>)}
            </optgroup>
          </select>
          {type && legs.length > 1 && <>
            <label className="sr" htmlFor="msg-leg">{t("fl.cmp.flight")}</label>
            <select id="msg-leg" className="pick ltr" value={leg} onChange={(e) => setLeg(Number(e.target.value))}>{legs.map((l, i) => <option key={l.id} value={i}>{l.label}</option>)}</select>
          </>}
        </div>

        {type && msg && (
          <div className="stack">
            {autoFields.length > 0 && <p className="muted"><small>{t("fl.cmp.auto")}: <span className="ltr">{autoFields.map((f) => f.field).join(" · ")}</span></small></p>}
            {fields.map(({ f, req }) => f.field === "delay" ? (
              <div key="delay">
                <label>{t("fl.cmp.delayLabel")}{!req && <small className="muted"> ({t("fl.cmp.optional")})</small>}</label>
                <div className="row">
                  {[0, 1].map((i) => (
                    <select key={i} className="pick ltr" aria-label={i === 0 ? t("fl.cmp.delay1") : t("fl.cmp.delay2")} value={codes[i]} onChange={(e) => { const c: [string, string] = [...codes]; c[i] = e.target.value; setCodes(c); }}>
                      <option value="">{i === 0 ? t("fl.cmp.delayPick") : t("fl.cmp.delay2")}</option>
                      {iata.filter((c) => c.code !== codes[1 - i]).map((c) => <option key={c.id} value={c.code}>{`${c.code} — ${c.description}`}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            ) : input(f, req))}
            {extra.length > 0 && <><p>{t("fl.cmp.fillMore")}</p>{extra.map((f) => input(f, true))}</>}
            <button type="button" className="btn gold" disabled={pending} onClick={build}>{pending ? t("fl.cmp.building") : t("fl.cmp.build")}</button>
          </div>
        )}
      </>}
      {res?.status === "error" && <p role="alert" className="err ltr">{res.message}</p>}
      {saved && res?.status === "ok" && <p role="status" className="muted">{t("fl.cmp.saved")}</p>}
    </div>
  );
}
