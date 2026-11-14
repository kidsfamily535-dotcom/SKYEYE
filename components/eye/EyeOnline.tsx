"use client";
import { useEffect, useState } from "react";

// Shows a calm amber bar when the connection drops, and a brief "back online" note when it returns. The page underneath stays as it was.
export default function EyeOnline({ offline, online }: { offline: string; online: string }) {
  const [state, setState] = useState<"ok" | "off" | "back">("ok");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = () => { clearTimeout(timer); setState("off"); };
    const on = () => { setState("back"); timer = setTimeout(() => setState("ok"), 3000); };
    if (!navigator.onLine) off();
    window.addEventListener("offline", off); window.addEventListener("online", on);
    return () => { clearTimeout(timer); window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  if (state === "ok") return null;
  return <div className={`eye-conn ${state}`} role="status" aria-live="polite">{state === "off" ? offline : online}</div>;
}
