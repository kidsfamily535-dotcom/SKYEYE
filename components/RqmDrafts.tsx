"use client";
import { useState, useTransition } from "react";
import { markMessageSent, rejectMessageDraft } from "@/app/flights/actions";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import { useT } from "@/components/I18n";
import type { FlightRqm } from "@/lib/flights";

/** RQM drafts SKYEYE prepared on its own. The employee copies, sends from the company mailbox, then records it here. */
export default function RqmDrafts({ drafts, canAct }: { drafts: FlightRqm[]; canAct: boolean }) {
  const { t } = useT();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => { const r = await fn(); setMsg(r.ok ? null : r.message ?? t("fl.rqm.err")); setConfirm(null); });
  if (drafts.length === 0) return null;
  return (
    <div className="card" id="rqm">
      <h2>{t("fl.rqm.title")}<Hint>{t("fl.rqm.hint")}</Hint></h2>
      {drafts.map((d) => {
        const sent = !!d.sentAt;
        return (
          <div key={d.id} className="draft">
            <small className="muted">{d.followup ? t("fl.rqm.followup") : ""}{sent ? <>{t("fl.rqm.sentPre")} <span className="ltr">{fmtUtc(d.sentAt)}</span> {t("fl.rqm.sentPost")}</> : <>{t("fl.rqm.readyPre")} <span className="ltr">{fmtUtc(d.createdAt)}</span></>}</small>
            <pre className="ltr mono orig">{d.body}</pre>
            {d.warnings.map((w, i) => <p key={i} className="muted">⚠ {w}</p>)}
            {!sent && canAct && (
              <div className="row">
                <button type="button" className="btn sm" onClick={async () => { await navigator.clipboard.writeText(d.body); setCopied(d.id); setTimeout(() => setCopied(null), 1500); }}>{copied === d.id ? t("copy.done") : t("fl.act.copy")}</button>
                <span className="grow" />
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => rejectMessageDraft(d.id))}>{t("fl.rqm.notNeeded")}</button>
                {confirm === d.id
                  ? <button type="button" className="btn gold" disabled={pending} onClick={() => run(() => markMessageSent(d.id))}>{t("fl.rqm.confirm")}</button>
                  : <button type="button" className="btn gold" disabled={pending} onClick={() => setConfirm(d.id)}>{t("fl.rqm.sentBtn")}</button>}
              </div>
            )}
          </div>
        );
      })}
      {msg && <p role="alert" className="muted">{msg}</p>}
    </div>
  );
}
