import Link from "next/link";
import UtcClock from "./UtcClock";
import type { CommandData } from "@/lib/data";

const nav = [
  { href: "/", label: "قيادتي", session: 1 },
  { label: "الوارد والمسودات", session: 3 }, { label: "الطلبات", session: 4 }, { label: "الرحلات", session: 5 },
  { label: "تقرير الوردية", session: 6 }, { label: "كلّم الوكيل", session: 7 }, { label: "الإعدادات", session: 7 },
];

export default function Shell({ data, children }: { data: CommandData; children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side" aria-label="القائمة الرئيسية">
        <div className="brand"><b className="logo">{data.company.name.slice(0, 5)}</b><div><strong>SKYEYE</strong><small>{data.company.name} · {data.company.kind}</small></div></div>
        <nav>
          {nav.map((n) => n.href
            ? <Link key={n.label} href={n.href} className="nav on" aria-current="page">{n.label}</Link>
            : <span key={n.label} className="nav off" aria-disabled="true">{n.label}<em>جلسة {n.session}</em></span>)}
        </nav>
      </aside>
      <div className="main">
        <header className="top">
          <label className="search"><span className="sr">بحث</span><input placeholder="ابحث عن رحلة أو إيميل أو شركة طيران…" disabled /></label>
          <UtcClock />
          {data.shadowMode && <span className="chip shadow">وضع الظل · لا يُرسل شيء</span>}
          <div className="user"><span className="av">م</span><div><strong>{data.user.name}</strong><small>{data.user.role}</small></div></div>
        </header>
        {children}
      </div>
    </div>
  );
}
