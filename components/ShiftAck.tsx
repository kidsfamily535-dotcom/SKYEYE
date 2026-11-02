"use client";
import { useState, useTransition } from "react";
import { acknowledgeShift } from "@/app/handover/actions";
import { useT } from "./I18n";

export default function ShiftAck({ reportId, openCount }: { reportId: string; openCount: number }) {
  const { t } = useT();
  const [note, setNote] = useState("");
  const [take, setTake] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="open-form" aria-label={t("ack.aria")}>
      <label>{t("ack.note")}<textarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
      {openCount > 0 && (
        <label className="inline"><input type="checkbox" checked={take} onChange={(e) => setTake(e.target.checked)} />{t("ack.take", { n: openCount })}</label>
      )}
      <p className="muted">{openCount > 0 ? t("ack.keep") : t("ack.none")}</p>
      {msg && <p role="alert" className="err">{msg}</p>}
      <div className="row"><button type="button" className="btn gold" disabled={pending} onClick={() => start(async () => { const r = await acknowledgeShift(reportId, note, take && openCount > 0); setMsg(r.ok ? null : r.message); })}>{t("ack.btn")}</button></div>
    </div>
  );
}
