"use client";
import { useEffect, useRef } from "react";

/** Header user chip: just the avatar (and the name on wide screens); name, role and sign-out live in the dropdown. Closes on outside click and Escape. */
export default function UserMenu({ name, role, signout }: { name: string; role: string; signout: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (e: Event) => { const d = ref.current; if (d?.open && !(e.target instanceof Node && d.contains(e.target))) d.open = false; };
    const esc = (e: KeyboardEvent) => { const d = ref.current; if (e.key === "Escape" && d?.open) { d.open = false; d.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <details className="menu userm" ref={ref}>
      <summary aria-label={name}>
        <span className="av">{name.slice(0, 1)}</span>
        <span className="un">{name}</span>
        <svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true"><path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <div className="menu-list">
        <div className="um-id"><strong>{name}</strong><small>{role}</small></div>
        <form action="/auth/signout" method="post"><button className="btn">{signout}</button></form>
      </div>
    </details>
  );
}
