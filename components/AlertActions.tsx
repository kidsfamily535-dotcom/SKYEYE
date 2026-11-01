"use client";
import { useState, useTransition } from "react";
import { setAlertStatus } from "@/app/requests/actions";

export default function AlertActions({ companyId, alertId, status }: { companyId: string; alertId: string; status: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (s: "acknowledged" | "dismissed") => start(async () => { const r = await setAlertStatus(companyId, alertId, s); setMsg(r.ok ? null : r.message); });
  return (
    <div className="row">
      {status === "open" && <button type="button" className="btn sm" disabled={pending} onClick={() => go("acknowledged")}>رأيت التنبيه</button>}
      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => go("dismissed")}>تجاهل</button>
      {msg && <span role="alert" className="err">{msg}</span>}
    </div>
  );
}
