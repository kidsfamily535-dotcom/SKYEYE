"use client";
import { useState, useTransition } from "react";
import { markMessageSent, rejectMessageDraft, saveMessageDraft } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import { useT } from "@/components/I18n";
import type { PanelDraft } from "@/lib/flights";

/** Drafts of every message type on this flight (RQM has its own card). The employee edits, copies, sends from the company mailbox, then records it. The system sends nothing. */
export default function MessageDrafts({ drafts, canAct }: { drafts: PanelDraft[]; canAct: boolean }) {
  const { t } = useT();
  const shown = drafts.filter((d) => d.type !== "RQM" && (d.status === "draft" || (d.sentAt && d.status === "approved")));
  const [text, setText] = useState<Record<string, string>>({});
  const [dev, setDev] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [okId, setOkId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cur = (d: PanelDraft) => text[d.id] ?? d.body;
  const dirty = (d: PanelDraft) => cur(d) !== d.body;
  const save = async (d: PanelDraft) => { const r = await saveMessageDraft(d.id, cur(d)); if (r.ok) setDev((p) => ({ ...p, [d.id]: r.deviations })); return r; };
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, id?: string) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.message ?? t("fl.rqm.err")); setOkId(r.ok ? id ?? null : null); setConfirm(null); });
  return (
    <div className="card" id="drafts">
      <h2>{t("fl.drf.title")}<Hint>{t("fl.drf.hint")}</Hint></h2>
      {shown.length === 0 && <p className="muted">{t("fl.drf.none")}</p>}
      {shown.map((d) => {
        const sent = !!d.sentAt;
        return (
          <div key={d.id} className="draft">
            <small className="muted"><b className="ltr">{d.type}</b> · {sent ? <>{t("fl.drf.sentAt")} <span className="ltr">{fmtUtc(d.sentAt)}</span></> : <>{t("fl.drf.ready")} <span className="ltr">{fmtUtc(d.createdAt)}</span></>}</small>
            {sent || !canAct
              ? <pre className="ltr mono orig">{d.body}</pre>
              : <textarea className="ltr mono" rows={Math.min(14, Math.max(4, cur(d).split("\n").length + 1))} aria-label={t("fl.drf.sentAria")} value={cur(d)} onChange={(e) => { setText({ ...text, [d.id]: e.target.value }); setOkId(null); }} />}
            {d.warnings.map((w, i) => <p key={i} className="muted ltr">⚠ {w}</p>)}
            {(dev[d.id] ?? []).length > 0 && <div className="err ltr"><small>{t("fl.drf.gom")}</small>{(dev[d.id] ?? []).map((x, i) => <p key={i} className="err ltr">{x}</p>)}</div>}
            {!sent && canAct && (
              <div className="row">
                <button type="button" className="btn sm" onClick={async () => { await navigator.clipboard.writeText(cur(d)); setCopied(d.id); setTimeout(() => setCopied(null), 1500); }}>{copied === d.id ? t("copy.done") : t("fl.act.copy")}</button>
                <button type="button" className="btn sm" disabled={pending || !dirty(d)} onClick={() => run(() => save(d), d.id)}>{okId === d.id ? t("fl.drf.saved") : t("fl.drf.save")}</button>
                <span className="grow" />
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => rejectMessageDraft(d.id))}>{t("fl.rqm.notNeeded")}</button>
                {confirm === d.id
                  ? <button type="button" className="btn gold" disabled={pending} onClick={() => run(async () => { if (dirty(d)) { const s = await save(d); if (!s.ok) return s; } return markMessageSent(d.id); })}>{t("fl.rqm.confirm")}</button>
                  : <button type="button" className="btn gold" disabled={pending} onClick={() => setConfirm(d.id)}>{t("fl.rqm.sentBtn")}</button>}
              </div>
            )}
            {confirm === d.id && dirty(d) && <small className="muted">{t("fl.drf.edited")}</small>}
          </div>
        );
      })}
      {msg && <p role="alert" className="muted">{msg}</p>}
    </div>
  );
}
