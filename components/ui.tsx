import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

/** Every page starts with this: one h1 and, on the left, that page's main action(s). */
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow"><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

/** List on one side, details on the other (collapses to one column on small screens). */
export function Split({ children }: { children: ReactNode }) {
  return <div className="split">{children}</div>;
}

/** Link-based tabs: the active tab lives in the URL, so it survives refresh and sharing. */
export function Tabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => <Link key={t.href} role="tab" aria-selected={t.active} className={t.active ? "on" : ""} href={t.href}>{t.label}</Link>)}
    </div>
  );
}

export function Tag({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

/** pct is 0-100 and must come from real recorded data (callers show "—" instead when unknown). */
export function ProgressBar({ pct, label, off }: { pct: number; label: string; off?: boolean }) {
  return <div className={`bar ${off ? "off" : ""}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${pct}%` }} /></div>;
}

/** Shown when the signed-in account is not linked to a company yet. */
export function NoCompany() {
  return <section className="card"><Empty>حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</Empty></section>;
}
