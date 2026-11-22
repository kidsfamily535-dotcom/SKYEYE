"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Slim toolbar over the full-page tower map of the command page. Everything that used to sit around the map
// (tower call, what needs you, agent line, library) lives in a dropdown behind one button each, so the map stays the page.
// One dropdown open at a time; closes on Escape or a press outside. The panels are rendered by the server page and only shown/hidden here.

export type DockItem = { id: string; label: string; badge?: number; tone?: "late" | "warn" | "info" | "ok"; panel: ReactNode };

export default function CommandDock({ title, date, shadow, items, defaultOpen }: { title: string; date: string; shadow?: string; items: DockItem[]; defaultOpen?: string }) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, []);

  return (
    <div className="cd" ref={box}>
      <div className="cd-bar">
        <h1 className="cd-title"><span className="cd-ico" aria-hidden="true">✈</span>{title}</h1>
        <span className="cd-date ltr">{date}</span>
        {shadow && <span className="cd-shadow">{shadow}</span>}
        <div className="cd-tabs" role="toolbar" aria-label={title}>
          {items.map((it) => {
            const on = open === it.id;
            return (
              <button key={it.id} type="button" id={`cd-b-${it.id}`} className={`cd-btn${it.tone ? ` ${it.tone}` : ""}${on ? " on" : ""}`} aria-expanded={on} aria-controls={`cd-p-${it.id}`} onClick={() => setOpen(on ? null : it.id)}>
                <span>{it.label}</span>
                {it.badge ? <b className="cd-n ltr">{it.badge}</b> : null}
                <svg className="cd-chev" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2 4.2l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            );
          })}
        </div>
      </div>
      {items.map((it) => (
        <div key={it.id} id={`cd-p-${it.id}`} className="cd-panel" role="region" aria-labelledby={`cd-b-${it.id}`} hidden={open !== it.id}>{it.panel}</div>
      ))}
    </div>
  );
}
