"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openMessageDraft, saveMessageDraft, type Opened } from "@/app/flights/actions";
import { useT } from "@/components/I18n";
import Hint from "@/components/Hint";
import type { CcField, CcOther, CcStep, CommandCenter } from "@/lib/command-center";
import type { DelayCode } from "@/lib/flights";

const looksJson = (f: CcField) => /^\s*[\[{]/.test(f.format);

/** The employee's private library of movement messages for this flight.
 *  Opening a message shows its draft in the GOM format (filled from what the agent knows) or asks for exactly what is missing.
 *  The employee edits and saves. Nothing is sent from here and nothing is locked by the order: sending stays outside, from the company mailbox. */

type Panel =
  | { kind: "draft"; id: string; body: string; warnings: string[] }
  | { kind: "missing"; fields: CcField[] }
  | { kind: "error"; message: string };

function fromOpened(o: Opened): Panel {
  if (o.status === "ready") return { kind: "draft", id: o.draftId, body: o.body, warnings: o.warnings };
  if (o.status === "missing") return { kind: "missing", fields: o.missing };
  return { kind: "error", message: o.message };
}

function Editor({ panel, canAct, onSaved }: { panel: Extract<Panel, { kind: "draft" }>; canAct: boolean; onSaved: () => void }) {
  const { t } = useT();
  const [saved, setSaved] = useState(panel.body);
  const [text, setText] = useState(panel.body);
  const [dev, setDev] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const dirty = text !== saved;
  const save = () => start(async () => {
    const r = await saveMessageDraft(panel.id, text);
    if (r.ok) { setSaved(text); setDev(r.deviations); setMsg(null); setOk(true); onSaved(); } else { setMsg(r.message); setOk(false); }
  });
  return (
    <div className="mv-edit draft">
      {panel.warnings.map((w, i) => <p key={i} className="muted ltr">⚠ {w}</p>)}
      <textarea className="ltr mono" rows={Math.min(14, Math.max(4, text.split("\n").length + 1))} aria-label={t("fl.drf.sentAria")} value={text} readOnly={!canAct} onChange={(e) => { setText(e.target.value); setOk(false); }} />
      {dev.length > 0 && <div className="err ltr"><small>{t("fl.drf.gom")}</small>{dev.map((x, i) => <p key={i} className="err ltr">{x}</p>)}</div>}
      <div className="row">
        <button type="button" className="btn sm" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t("copy.done") : t("fl.act.copy")}</button>
        {canAct && <button type="button" className="btn gold sm" disabled={pending || !dirty} onClick={save}>{ok && !dirty ? t("fl.drf.saved") : t("fl.drf.save")}</button>}
      </div>
      {msg && <p role="alert" className="err">{msg}</p>}
    </div>
  );
}

/** Asks for exactly the values the database said are missing. The delay reason is picked from the IATA codes (up to two), never typed as JSON;
 *  other JSON-shaped fields (load lists, positions) get a multi-line box. If no codes are loaded, the delay field falls back to plain text. */
function MissingForm({ fields, delayCodes, onSubmit, pending }: { fields: CcField[]; delayCodes: DelayCode[]; onSubmit: (v: Record<string, string>) => void; pending: boolean }) {
  const { t } = useT();
  const [v, setV] = useState<Record<string, string>>({});
  const [codes, setCodes] = useState<[string, string]>(["", ""]);
  const iata = useMemo(() => delayCodes.filter((c) => c.scheme === "IATA"), [delayCodes]);
  const pickCodes = (f: CcField) => f.field === "delay" && iata.length > 0;
  const filled = (f: CcField) => (pickCodes(f) ? !!codes[0] : !!(v[f.field] ?? "").trim());
  const submit = () => {
    const values = { ...v };
    const picked = codes.filter(Boolean);
    if (picked.length) values.delay = JSON.stringify({ codes: picked });
    onSubmit(values);
  };
  return (
    <div className="mv-missing">
      <p className="muted">{t("fl.mv.missing")}</p>
      {fields.map((f) => pickCodes(f) ? (
        <div key={f.field} className="mv-field" role="group" aria-label={t("fl.cmp.delayLabel")}>
          <span>{t("fl.cmp.delayLabel")}</span>
          <div className="row">
            {[0, 1].map((i) => (
              <select key={i} className="pick ltr" aria-label={i === 0 ? t("fl.cmp.delay1") : t("fl.cmp.delay2")} disabled={i === 1 && !codes[0]} value={codes[i]}
                onChange={(e) => { const c: [string, string] = [...codes]; c[i] = e.target.value; setCodes(c); }}>
                <option value="">{i === 0 ? t("fl.cmp.delayPick") : t("fl.cmp.delay2")}</option>
                {iata.filter((c) => c.code !== codes[1 - i]).map((c) => <option key={c.id} value={c.code}>{`${c.code} — ${c.description}`}</option>)}
              </select>
            ))}
          </div>
        </div>
      ) : (
        <label key={f.field} className="mv-field">
          <span>{f.label}</span>
          {looksJson(f)
            ? <textarea className="ltr mono" dir="ltr" rows={4} value={v[f.field] ?? ""} placeholder={f.format} onChange={(e) => setV({ ...v, [f.field]: e.target.value })} />
            : <input className="ltr" dir="ltr" value={v[f.field] ?? ""} placeholder={f.format} onChange={(e) => setV({ ...v, [f.field]: e.target.value })} />}
        </label>
      ))}
      <button type="button" className="btn gold sm" disabled={pending || fields.some((f) => !filled(f))} onClick={submit}>{t("fl.mv.make")}</button>
    </div>
  );
}

function Item({ id, openId, setOpenId, flightId, companyId, type, head, canAct, openable, existing, delayCodes }: {
  id: string; openId: string | null; setOpenId: (v: string | null) => void; flightId: string; companyId: string; type: string | null;
  head: React.ReactNode; canAct: boolean; openable: boolean; existing: CcStep["draft"]; delayCodes: DelayCode[];
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pending, start] = useTransition();
  const open = openId === id;
  const run = (values: Record<string, string>) => start(async () => { if (!type) return; const o = await openMessageDraft(companyId, flightId, type, values); setPanel(fromOpened(o)); if (o.status === "ready") router.refresh(); });
  const toggle = () => {
    if (!openable) return;
    if (open) { setOpenId(null); return; }
    setOpenId(id);
    if (existing && existing.status === "draft") { setPanel({ kind: "draft", id: existing.id, body: existing.body_text, warnings: existing.warnings ?? [] }); return; }
    if (!panel || panel.kind !== "draft") run({});
  };
  return (
    <li className={`mv-item${open ? " open" : ""}`}>
      <button type="button" className="mv-head" aria-expanded={open} disabled={!openable} onClick={toggle}>{head}</button>
      {open && (
        <div className="mv-body">
          {pending && <p className="muted">…</p>}
          {!pending && panel?.kind === "draft" && <Editor key={panel.id} panel={panel} canAct={canAct} onSaved={() => router.refresh()} />}
          {!pending && panel?.kind === "missing" && (canAct ? <MissingForm fields={panel.fields} delayCodes={delayCodes} pending={pending} onSubmit={run} /> : <p className="muted">{panel.fields.map((f) => f.label).join(" · ")}</p>)}
          {!pending && panel?.kind === "error" && <p role="alert" className="err">{panel.message}</p>}
        </div>
      )}
    </li>
  );
}

export default function MovementLibrary({ cc, companyId, canAct, delayCodes }: { cc: CommandCenter; companyId: string; canAct: boolean; delayCodes: DelayCode[] }) {
  const { t } = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const steps = cc.movement.steps;
  const send = steps.filter((s) => s.cycle === "send");
  const receive = steps.filter((s) => s.cycle === "receive");
  // "Whose turn": the first outgoing message that has no draft yet. Only a hint; nothing else is locked by it.
  const nextSeq = send.find((s) => s.state === "none" && s.composable)?.seq ?? null;

  const stateTag = (s: CcStep) => {
    if (s.state === "draft") return s.draft?.sent_at ? <span className="tag ok">{t("fl.mv.sent")}</span> : s.draft && s.draft.edits > 0 ? <span className="tag info">{t("fl.mv.edited")}</span> : <span className="tag ok">{t("fl.mv.ready")}</span>;
    if (s.state === "incoming") return <span className="tag">{t("fl.mv.incoming")}</span>;
    if (s.state === "internal") return <span className="tag">{t("fl.mv.internal")}</span>;
    // An outgoing format with no builder yet (e.g. PSM, DLA) cannot be opened: say so instead of "no draft".
    if (s.direction === "outgoing" && !s.composable) return <span className="tag muted">{t("fl.mv.manual")}</span>;
    return <span className="tag muted">{t("fl.mv.none")}</span>;
  };
  const stepHead = (s: CcStep) => (
    <>
      <b className="mv-seq ltr">{s.seq}</b>
      <span className="mv-main">
        <b className="ltr"><bdi>{s.title ?? s.step_type}</bdi></b>
        <small className="muted"><bdi>{s.trigger_ar ?? ""}</bdi>{s.note_ar ? <> · <bdi>{s.note_ar}</bdi></> : null}</small>
      </span>
      {s.cycle === "send" && s.seq === nextSeq && <span className="tag warn">{t("fl.mv.turn")}</span>}
      {stateTag(s)}
    </>
  );
  const group = (list: CcStep[], prefix: string) => (
    <ol className="mv-list">
      {list.map((s) => (
        <Item key={`${prefix}-${s.seq}`} id={`${prefix}-${s.seq}`} openId={openId} setOpenId={setOpenId} flightId={s.for_flight_id} companyId={companyId}
          type={s.format_type} canAct={canAct} existing={s.draft} head={stepHead(s)} delayCodes={delayCodes}
          openable={s.direction === "outgoing" && s.composable && !!s.format_type} />
      ))}
    </ol>
  );
  const otherHead = (o: CcOther) => <><b className="mv-seq ltr">{o.type}</b><span className="mv-main"><b className="ltr"><bdi>{o.title}</bdi></b></span>{!o.composable && <span className="tag muted">{t("fl.mv.manual")}</span>}</>;

  return (
    <div className="card" id="movement">
      <h2>{t("fl.mv.title")}<Hint>{t("fl.mv.hint")}</Hint></h2>
      {!cc.movement.order_approved && <p className="muted"><span className="tag warn">{t("fl.mv.orderDraft")}</span> {t("fl.mv.orderNote")}</p>}
      <h3 className="mv-h">{t("fl.mv.send")}</h3>
      {group(send, "send")}
      <h3 className="mv-h">{t("fl.mv.receive")}</h3>
      {group(receive, "recv")}
      <details className="mv-more">
        <summary>{t("fl.mv.others", { n: cc.movement.other_messages.length })}</summary>
        <ol className="mv-list">
          {cc.movement.other_messages.map((o) => (
            <Item key={o.type} id={`o-${o.type}`} openId={openId} setOpenId={setOpenId} flightId={cc.flight.id} companyId={companyId} type={o.type}
              canAct={canAct} existing={null} head={otherHead(o)} openable={o.composable} delayCodes={delayCodes} />
          ))}
        </ol>
      </details>
    </div>
  );
}
