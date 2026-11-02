"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "قيادتي" }, { href: "/inbox", label: "الوارد والمسودات" },
  { href: "/flights", label: "الرحلات" }, { href: "/agent", label: "كلّم الوكيل" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav>
      {items.map((n) => {
        const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return <Link key={n.href} href={n.href} className={`nav ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>{n.label}</Link>;
      })}
    </nav>
  );
}
