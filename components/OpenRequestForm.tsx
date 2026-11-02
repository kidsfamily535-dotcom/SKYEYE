"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { linkEmailToRequest, openRequestFromEmail } from "@/app/requests/actions";
import { useT } from "./I18n";

type Opt = { id: string; title: string; flightRef: string | null; stageLabelAr: string; stageLabel?: string };

export default function OpenRequestForm({ companyId, triageId, messageId, linked, linkable }: { companyId: string; triageId: string; messageId: string; linked: Opt[]; linkable: Opt[] }) {
  const { t } = useT();
  const [mode, setMode] = useState<"none" | "new" | "link">("none");
  const [f, setF] = useState({ title: "", flightRef: "", flightDate: "", dueAt: "", urgent: false });
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = (r: { ok: boolean; message?: string }) => { setMsg(r.ok ? null : r.message ?? t("draft.err")); if (r.ok) setMode("none"); };

  return (
    <div>
      {linked.length > 0 && <ul className="list">{linked.map((l) => <li key={l.id}><span><bdi>{l.title}</bdi><small className="muted">{l.stageLabel ?? l.stageLabelAr}</small></span></li>)}</ul>}
      {linked.length === 0 && <p className="muted">{t("req.form.unlinked")}</p>}
      {msg && <p role="alert" className="err">{msg}</p>}
      {mode === "none" && <div className="row"><button type="button" className="btn" onClick={() => setMode("new")}>{t("req.form.open")}</button>{linkable.length > 0 && <button type="button" className="btn ghost" onClick={() => setMode("link")}>{t("req.form.link")}</button>}</div>}
      {mode === "new" && (
        <div className="open-form">
          <label>{t("req.form.title")}<input value={f.title} maxLength={160} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>{t("req.form.flightRef")}<input className="ltr" value={f.flightRef} onChange={(e) => setF({ ...f, flightRef: e.target.value })} /></label>
          <label>{t("req.form.flightDate")}<input type="date" className="ltr" value={f.flightDate} onChange={(e) => setF({ ...f, flightDate: e.target.value })} /></label>
          <label>{t("req.form.due")}<input type="datetime-local" className="ltr" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></label>
          <p className="muted">{t("req.form.dueHint")}</p>
          <label className="inline"><input type="checkbox" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} />{t("req.form.urgent")}</label>
          <div className="row"><button type="button" className="btn gold" disabled={pending || !f.title.trim()} onClick={() => start(async () => done(await openRequestFromEmail({ triageId, ...f })))}>{t("req.form.submit")}</button><button type="button" className="btn ghost" onClick={() => setMode("none")}>{t("req.form.back")}</button></div>
        </div>
      )}
      {mode === "link" && (
        <div className="open-form">
          <label>{t("req.form.file")}<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">{t("req.form.pickFile")}</option>{linkable.map((o) => <option key={o.id} value={o.id}>{o.title} · {o.stageLabel ?? o.stageLabelAr}</option>)}</select></label>
          <div className="row"><button type="button" className="btn gold" disabled={pending || !target} onClick={() => start(async () => done(await linkEmailToRequest(companyId, target, messageId)))}>{t("req.form.linkBtn")}</button><button type="button" className="btn ghost" onClick={() => setMode("none")}>{t("req.form.back")}</button></div>
        </div>
      )}
    </div>
  );
}
