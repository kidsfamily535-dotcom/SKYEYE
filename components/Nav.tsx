"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const main = [
  { href: "/", label: "قيادتي" }, { href: "/inbox", label: "الوارد والمسودات" }, { href: "/flights", label: "الرحلات" },
  { href: "/requests", label: "الطلبات" }, { href: "/handover", label: "تقرير الوردية" },
];
const more = [{ href: "/agent", label: "كلّم الوكيل" }, { href: "/settings", label: "الإعدادات" }];

export default function Nav() {
  const path = usePathname();
  const link = (n: { href: string; label: string }) => {
    const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
    return <Link key={n.href} href={n.href} className={`nav ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>{n.label}</Link>;
  };
  return (
    <nav>
      {main.map(link)}
      <span className="nav-sep" role="separator" />
      {more.map(link)}
    </nav>
  );
}
