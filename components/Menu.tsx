"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "./I18n";

/** Small overflow menu for secondary actions. Closes on pick, outside click and Escape. */
export default function Menu({ label, children }: { label?: string; children: ReactNode }) {
  const { t } = useT();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (e: Event) => { const d = ref.current; if (d?.open && !(e.target instanceof Node && d.contains(e.target))) d.open = false; };
    const esc = (e: KeyboardEvent) => { const d = ref.current; if (e.key === "Escape" && d?.open) { d.open = false; d.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <details className="menu" ref={ref}>
      <summary className="btn ghost sm">{label ?? t("menu.more")} ▾</summary>
      <div className="menu-list" onClick={() => { if (ref.current) ref.current.open = false; }}>{children}</div>
    </details>
  );
}
