import Link from "next/link";
import Shell from "@/components/Shell";
import Radar from "@/components/Radar";
import { getCommandData, type Decision } from "@/lib/data";
import { getCockpit } from "@/lib/cockpit";
import { fmtUtc } from "@/lib/format";

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
  const m = c.memory;

  return (
    <Shell data={d}>
      <main className="page">
        <section className="hero">
          <div className="hero-text">
            <h1>{g.text}، فريق العمليات</h1>
            <p><span className="ltr">{g.date}</span> · هذا ما يحدث الآن وما ينتظر قرارك.</p>
            <ul className="stats">
              <li><b className="ltr">{dash(c.todayFlights)}</b>رحلات اليوم</li>
              <li><b className="ltr">{dash(c.onGround)}</b>طائرات على الأرض</li>
              <li><b className={`ltr ${attention > 0 ? "hot" : ""}`}>{d.noMembership ? "—" : attention}</b>تحتاج انتباهاً</li>
            </ul>
          </div>
          <div className="card glass"><h2>الرادار الحي</h2><Radar counts={c.radar} /></div>
        </section>

        {reco && (
          <section className="reco card" aria-label="توصية SKYEYE">
            <span className="eye" aria-hidden="true" />
            <div><small className="muted">توصية SKYEYE</small><p>{reco}</p></div>
            {first?.href && <Link className="btn gold" href={first.href}>{first.action}</Link>}
          </section>
        )}

        <div className="cols2">
          <section className="card"><h2>ما يحتاج انتباهك</h2>
            {d.noMembership && <p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p>}
            {!d.noMembership && stream.length === 0 && <p className="muted">لا شيء يحتاج قرارك الآن.</p>}
            <ul className="list">{stream.map((x) => (
              <li key={x.id}><i className={`dot ${x.tone}`} /><span>{x.text}</span>{x.href ? <Link className="btn sm" href={x.href}>{x.action}</Link> : null}</li>))}</ul>
          </section>
          <div className="side-col">
            <section className="card"><h2>طلباتك النشطة</h2>{d.requests.length === 0 && <p className="muted">لا توجد طلبات مفتوحة.</p>}
              <ul className="list">{d.requests.map((r) => (
                <li key={r.id}><b className="logo sm ltr">{r.airline}</b><span>{r.title}<small className="muted">{r.next}</small></span><em className={`tag ${r.tone}`}>{r.status}</em></li>))}</ul>
            </section>
          </div>
        </div>

        {m.lastShift && <p className="muted">آخر تسليم وردية: «{m.lastShift.name}» — {m.lastShift.acknowledged ? "تم الاستلام" : "بانتظار الاستلام"} · <span className="ltr">{fmtUtc(m.lastShift.at)}</span> · <Link href="/handover">فتح</Link></p>}
      </main>
    </Shell>
  );
}
