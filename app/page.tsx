import Link from "next/link";
import Shell from "@/components/Shell";
import Radar from "@/components/Radar";
import { getCommandData, type Decision } from "@/lib/data";
import { getCockpit } from "@/lib/cockpit";

const dash = (n: number | null) => (n ?? "—");
const RANK: Record<string, number> = { late: 0, warn: 1, info: 2, ok: 3 };
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

function greeting(now: Date) {
  const h = +new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(now) % 24;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "short" }).format(now);
  return { text: h >= 5 && h < 12 ? "صباح الخير" : h >= 12 ? "مساء الخير" : "أهلاً بك في وردية الليل", date };
}

export default async function CommandPage() {
  const [d, c] = await Promise.all([getCommandData(), getCockpit()]);
  const g = greeting(new Date());
  const stream: Decision[] = [...c.flightDecisions, ...d.decisions].sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  const attention = (d.counts.urgentAlerts ?? 0) + (c.delayed ?? 0);
  const first = stream[0];
  const reco = d.noMembership ? null
    : stream.length === 0 ? "لا شيء يحتاج قرارك الآن. أتابع البريد والرحلات وأنبّهك عند أي تغيير."
    : `لديك ${stream.length} ${stream.length === 1 ? "أمر يحتاج" : "أمور تحتاج"} متابعة. أقترح البدء بـ: ${short(first.text)}`;

  const TONE_AR: Record<string, string> = { late: "عاجل", warn: "مهم", info: "للعلم", ok: "تم" };
  const stat = (n: number | null | undefined, label: string, href: string, hot?: boolean) => (
    <Link href={href} className="hstat"><b className={`ltr ${hot ? "hot" : ""}`}>{d.noMembership ? "—" : dash(n ?? null)}</b><small>{label}</small></Link>);

  return (
    <Shell data={d}>
      <main className="page">
        <section className="fhero" aria-label="قيادتي">
          <h1>{g.text}، فريق العمليات</h1>
          <p><span className="ltr">{g.date}</span> · هذا ما يحدث الآن وما ينتظر قرارك.</p>
        </section>

        <section className="fsum four" aria-label="ملخص اليوم">
          {stat(c.todayFlights, "رحلات اليوم", "/flights?day=today")}
          {stat(c.onGround, "طائرات على الأرض", "/flights")}
          {stat(attention, "تحتاج انتباهاً", "#attention", attention > 0)}
          {stat(d.counts.inboxToReview, "إيميلات للمراجعة", "/inbox?f=new")}
        </section>

        {reco && (
          <section className="reco card" aria-label="توصية SKYEYE">
            <span className="eye" aria-hidden="true" />
            <div><small className="muted">توصية SKYEYE</small><p>{reco}</p></div>
            {first?.href && <Link className="btn gold" href={first.href}>{first.action}</Link>}
          </section>
        )}

        <div className="cols2">
          <section id="attention" aria-label="ما يحتاج انتباهك">
            <h2 className="sec">ما يحتاج انتباهك</h2>
            {d.noMembership && <div className="card"><p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p></div>}
            {!d.noMembership && stream.length === 0 && <div className="card"><p className="muted">لا شيء يحتاج قرارك الآن.</p></div>}
            <ul className="flist">{stream.map((x, i) => (
              <li key={x.id} className={`fcard ${i === 0 && x.tone === "late" ? "hot" : ""}`}>
                <div className="arow">
                  <span className={`fstatus ${x.tone === "ok" ? "ok" : x.tone}`}><b>{TONE_AR[x.tone]}</b></span>
                  <span className="atext"><bdi>{x.text}</bdi></span>
                  {x.href ? <Link className={`btn sm ${i === 0 ? "gold" : ""}`} href={x.href}>{x.action}</Link> : null}
                </div>
              </li>))}
            </ul>
          </section>
          <div className="side-col">
            <section className="card glass"><h2>الرادار الحي</h2><Radar counts={c.radar} /></section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
