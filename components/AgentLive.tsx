"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the conversation live: any change to this company's agent commands (new message, agent answering, agent done)
 * refreshes the page at once through Realtime. While a message is still waiting for the agent, it also re-reads every
 * 4 seconds as a safety net, so a dropped connection never leaves the chat frozen.
 */
export default function AgentLive({ companyId, active }: { companyId: string; active: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const sb = createClient();
    const kick = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => router.refresh(), 250); };
    const ch = sb.channel(`agent-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_commands", filter: `company_id=eq.${companyId}` }, kick)
      .subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); sb.removeChannel(ch); };
  }, [companyId, router]);
  useEffect(() => { if (!active) return; const t = setInterval(() => router.refresh(), 4000); return () => clearInterval(t); }, [active, router]);
  return null;
}
