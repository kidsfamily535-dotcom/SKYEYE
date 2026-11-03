"use client";
import { useState, useTransition } from "react";
import { reviewMvt } from "@/app/mvt/actions";
import { useT } from "./I18n";
import type { MvtItem } from "@/lib/mvt";

const hm = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";

export default function MvtReview({ item }: { item: MvtItem }) {
  const { t } = useT();
  const [flight, setFlight] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const needFlight = !item.flightId;
  const canApprove = item.parseStatus !== "failed" && (!needFlight || !!flight);

  const run = (d: "approve" | "reject") => start(async () => {
    const r = await reviewMvt(item.id, d, needFlight && flight ? flight : undefined);
    setMsg(!r.ok ? r.message : r.status === "conflict" ? `${t("mvt.conflict")}: ${r.detail ?? ""}` : null);
  });

  return (
    <article className="card">
      <header><strong className="ltr">{item.subject ?? "MVT"}</strong> <small className="ltr">{item.at ? hm(item.at) : ""} · {item.direction}</small></header>
      <pre className="ltr" style={{ whiteSpace: "pre-wrap" }}>{item.body}</pre>
      <p>{item.flightLabel ? <b className="ltr">{item.flightLabel}</b> : t("mvt.unmatched")}</p>
      {needFlight && (
        <select value={flight} onChange={(e) => setFlight(e.target.value)} aria-label={t("mvt.pickFlight")}>
          <option value="">{t("mvt.pickFlight")}</option>
          {item.candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
      {item.events.length > 0 && <ul className="ltr">{item.events.map((e, i) => <li key={i}>{e.event_type} — {hm(e.occurred_at)}</li>)}</ul>}
      {[...item.warnings, ...item.notes].map((w, i) => <p key={i} className="ltr"><small>⚠ {w}</small></p>)}
      {item.parseStatus === "failed" && <p>{t("mvt.failed")}</p>}
      {msg && <p role="alert">{msg}</p>}
      <div className="row">
        <button type="button" className="btn gold" disabled={pending || !canApprove} onClick={() => run("approve")}>{t("mvt.approve")}</button>
        <button type="button" className="btn danger" disabled={pending} onClick={() => run("reject")}>{t("mvt.reject")}</button>
      </div>
    </article>
  );
}
