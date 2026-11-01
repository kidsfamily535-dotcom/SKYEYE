"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While commands are waiting or running, re-read the page every 8 seconds. Idle: no polling. */
export default function AgentRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => { if (!active) return; const t = setInterval(() => router.refresh(), 8000); return () => clearInterval(t); }, [active, router]);
  return null;
}
