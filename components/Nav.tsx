"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";
import type { Key } from "@/lib/i18n";

const ICONS: Record<string, string> = {
  "/": "M3 11l9-7 9 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1z",
  "/inbox": "M3 7l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  "/flights": "M2 14l20-8-6 14-4-6z",
  "/agent": "M4 5h16v11H9l-5 4z",
  "/files": "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
};

const items: { href: string; label: Key }[] = [
  { href: "/", label: "nav.home" }, { href: "/inbox", label: "nav.inbox" },
  { href: "/flights", label: "nav.flights" }, { href: "/agent", label: "nav.agent" },
  { href: "/files", label: "nav.files" },
];

export default function Nav() {
  const path = usePathname();
  const { t } = useT();
  return (
    <nav>
      {items.map((n) => {
        const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={`nav ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[n.href]} /></svg>
            <span>{t(n.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
