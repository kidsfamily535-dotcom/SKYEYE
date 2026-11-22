"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Goes back to where the employee came from (the radar, the board…) when that was this app; otherwise to the given page. */
export default function BackLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  const sameApp = () => { try { return !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch { return false; } };
  return <Link href={href} className="back" onClick={(e) => { if (sameApp()) { e.preventDefault(); router.back(); } }}>{children}</Link>;
}
