import Nav from "./Nav";
import UtcClock from "./UtcClock";
import type { CommandData } from "@/lib/data";

export default function Shell({ data, children }: { data: CommandData; children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side" aria-label="القائمة الرئيسية">
        <div className="brand"><b className="logo">{data.company.name.slice(0, 5)}</b><div><strong>SKYEYE</strong><small>{data.company.name} · {data.company.kind}</small></div></div>
        <Nav />
      </aside>
      <div className="main">
        <header className="top">
          <span className="grow" />
          <UtcClock />
          {data.shadowMode && <span className="chip shadow">وضع الظل · لا يُرسل شيء</span>}
          <div className="user"><span className="av">{data.user.name.slice(0, 1)}</span><div><strong>{data.user.name}</strong><small>{data.user.role}</small></div><form action="/auth/signout" method="post"><button className="btn ghost">خروج</button></form></div>
        </header>
        {children}
      </div>
    </div>
  );
}
