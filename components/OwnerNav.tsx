"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";

const ICONS = {
  companies: "M3 21V9l9-5 9 5v12M9 21v-6h6v6M7 11h.01M12 11h.01M17 11h.01",
  add: "M12 5v14M5 12h14",
};

export default function OwnerNav() {
  const path = usePathname();
  const { t } = useT();
  const items = [
    { href: "/admin", icon: ICONS.companies, label: t("own.nav.companies"), on: path === "/admin" || (path.startsWith("/admin/") && path !== "/admin/new") },
    { href: "/admin/new", icon: ICONS.add, label: t("own.nav.add"), on: path === "/admin/new" },
  ];
  return (
    <nav>
      {items.map((n) => (
        <Link key={n.href} href={n.href} className={`nav ${n.on ? "on" : ""}`} aria-current={n.on ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
          <span>{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}
