"use client";
import { useState, useTransition } from "react";
import { cancelAgentCommand } from "@/app/agent/actions";

export default function AgentCancel({ companyId, commandId }: { companyId: string; commandId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="row">
      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => start(async () => { const r = await cancelAgentCommand(companyId, commandId); setMsg(r.ok ? null : r.message); })}>إلغاء الأمر</button>
      {msg && <span role="alert" className="err">{msg}</span>}
    </span>
  );
}
