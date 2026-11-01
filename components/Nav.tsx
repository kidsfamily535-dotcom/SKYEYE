"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items: { href?: string; label: string; session: number }[] = [
  { href: "/", label: "قيادتي", session: 1 }, { href: "/inbox", label: "الوارد والمسودات", session: 3 },
  { label: "الطلبات", session: 4 }, { label: "الرحلات", session: 5 }, { label: "تقرير الوردية", session: 6 }, { label: "كلّم الوكيل", session: 7 }, { label: "الإعدادات", session: 7 },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav>
      {items.map((n) => {
        if (!n.href) return <span key={n.label} className="nav off" aria-disabled="true">{n.label}<em>جلسة {n.session}</em></span>;
        const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return <Link key={n.label} href={n.href} className={`nav ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>{n.label}</Link>;
      })}
    </nav>
  );
}
