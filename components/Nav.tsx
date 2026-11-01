"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Grouped by how the work is done: what you do all shift, then what you follow up on. */
const groups: { title: string; items: { href: string; label: string }[] }[] = [
  { title: "العمل اليومي", items: [
    { href: "/", label: "قيادتي" }, { href: "/flights", label: "الرحلات" }, { href: "/requests", label: "الطلبات" }, { href: "/inbox", label: "الوارد والمسودات" },
  ] },
  { title: "المتابعة", items: [
    { href: "/handover", label: "تقرير الوردية" }, { href: "/agent", label: "كلّم الوكيل" },
  ] },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="التنقل">
      {groups.map((g) => (
        <div key={g.title} className="nav-group" role="group" aria-label={g.title}>
          <small className="nav-title">{g.title}</small>
          {g.items.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return <Link key={n.href} href={n.href} className={`nav ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>{n.label}</Link>;
          })}
        </div>
      ))}
    </nav>
  );
}
