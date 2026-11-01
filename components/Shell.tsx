import Nav from "./Nav";
import UtcClock from "./UtcClock";
import AlertBell from "./AlertBell";
import AgentBar, { type AgentCtx } from "./AgentBar";
import ShiftReportButton from "./ShiftReportButton";
import { getBellItems, type Scope } from "@/lib/alerts";
import { getShiftPeek } from "@/lib/shifts";
import type { CommandData } from "@/lib/data";

/**
 * Every page sits in this shell. `scope` decides what the bell shows; `agent` binds the always-visible command bar to what the page has open
 * (a flight, an email, a request). The /agent page passes scope "agent" and has no bar, because it is the conversation itself.
 */
export default async function Shell({ data, scope = "home", agent = null, children }: { data: CommandData; scope?: Scope; agent?: AgentCtx | null; children: React.ReactNode }) {
  const member = !data.noMembership;
  const [peek, bell] = member ? await Promise.all([getShiftPeek(), getBellItems(scope)]) : [null, []];
  const bar = member && peek && scope !== "agent";
  return (
    <div className="app">
      <aside className="side" aria-label="القائمة الرئيسية">
        <div className="brand"><b className="logo">{data.company.name.slice(0, 5)}</b><div><strong>SKYEYE</strong><small>{data.company.name} · {data.company.kind}</small></div></div>
        <Nav />
      </aside>
      <div className={`main ${bar ? "has-bar" : ""}`}>
        <header className="top">
          <label className="search"><span className="sr">بحث</span><input placeholder="ابحث عن رحلة أو إيميل أو شركة طيران…" disabled /></label>
          <UtcClock />
          {data.shadowMode && <span className="chip shadow">وضع الظل · لا يُرسل شيء</span>}
          {peek && <ShiftReportButton peek={peek} />}
          {member && <AlertBell scope={scope} items={bell} />}
          <div className="user"><span className="av">{data.user.name.slice(0, 1)}</span><div><strong>{data.user.name}</strong><small>{data.user.role}</small></div><form action="/auth/signout" method="post"><button className="btn ghost">خروج</button></form></div>
        </header>
        {children}
        {bar && peek && <AgentBar key={agent?.targetId ?? "none"} companyId={data.company.id} canWrite={peek.canWrite} ctx={agent} />}
      </div>
    </div>
  );
}
