"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BellItem, Scope } from "@/lib/alerts";

const TITLE: Record<Scope, string> = { home: "تنبيهات اليوم", flights: "تنبيهات الرحلات", inbox: "تنبيهات الوارد", requests: "تنبيهات الطلبات", handover: "تنبيهات اليوم", agent: "تنبيهات اليوم" };
const EMPTY: Record<Scope, string> = { home: "لا تنبيهات الآن.", flights: "لا تنبيهات على الرحلات الآن.", inbox: "لا إيميلات عاجلة ولا مسودات تنتظرك.", requests: "لا تنبيهات على الطلبات الآن.", handover: "لا تنبيهات الآن.", agent: "لا تنبيهات الآن." };

/** One bell in the header of every page; the list and the counter belong to the page that is open. */
export default function AlertBell({ scope, items }: { scope: Scope; items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const n = items.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey); window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [open]);

  return (
    <div className="bell" ref={box}>
      <button type="button" className="iconbtn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={n > 0 ? `${TITLE[scope]}: ${n}` : `${TITLE[scope]}: لا يوجد`}>
        <span aria-hidden="true">🔔</span>{n > 0 && <b className="count ltr" aria-hidden="true">{n > 99 ? "99+" : n}</b>}
      </button>
      {open && (
        <div className="pop" role="region" aria-label={TITLE[scope]}>
          <h2>{TITLE[scope]}</h2>
          {n === 0 && <p className="muted">{EMPTY[scope]}</p>}
          <ul className="list">
            {items.map((a) => (
              <li key={a.id}><i className={`dot ${a.tone}`} /><span>{a.text}{a.sub && <small className="muted"><bdi>{a.sub}</bdi></small>}</span><Link className="btn ghost sm" href={a.href} onClick={() => setOpen(false)}>افتح</Link></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
