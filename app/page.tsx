import Link from "next/link";
import Shell from "@/components/Shell";
import Radar from "@/components/Radar";
import FlightList from "@/components/FlightList";
import { getCommandData } from "@/lib/data";
import { getTodayFlights } from "@/lib/flights";

const dash = (n: number | null) => (n ?? "—");

export default async function CommandPage() {
  const [d, today] = await Promise.all([getCommandData(), getTodayFlights()]);
  const nextUp = today.slice(0, 5);
  return (
    <Shell data={d} scope="home">
      <main className="page">
        <section className="hero">
          <div className="hero-text">
            <h1>صباح الخير. كيف أساعدك اليوم؟</h1>
            <p>أنا أتابع البريد والرحلات. هذا ما يحتاج قرارك الآن.</p>
            <ul className="stats">
              <li><b className="ltr">{dash(d.counts.inboxToReview)}</b>إيميل للمراجعة</li>
              <li><b className="ltr">{dash(d.counts.draftsWaiting)}</b>مسودة تنتظر قرارك</li>
              <li><b className="ltr">{dash(d.counts.urgentAlerts)}</b>تنبيه عاجل</li>
            </ul>
          </div>
          <div className="card glass"><h2>الرادار الحي</h2><Radar counts={d.radar} /></div>
        </section>

        <section className="card" aria-label="رحلات اليوم">
          <div className="row between"><h2>رحلات اليوم</h2><Link className="btn ghost sm" href="/flights">كل رحلات اليوم</Link></div>
          <p className="muted">بتوقيت UTC، الأقرب أولاً، وتحت كل رحلة أقرب خطوة لها.</p>
          {d.noMembership && <p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p>}
          {!d.noMembership && today.length === 0 && <p className="muted">لا توجد رحلات اليوم. ارفع برنامج الرحلات من صفحة الرحلات.</p>}
          <FlightList rows={nextUp} showNext hrefFor={(r) => `/flights?id=${r.rotationId}`} />
          {today.length > nextUp.length && <p className="muted">و{today.length - nextUp.length} رحلات أخرى اليوم.</p>}
        </section>

        <div className="cols">
          <section className="card"><h2>الوكيل يقول لك</h2>
            {d.noMembership && <p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p>}{!d.noMembership && d.decisions.length === 0 && <p className="muted">لا شيء يحتاج قرارك الآن.</p>}
            <ul className="list">{d.decisions.map((x) => (
              <li key={x.id}><i className={`dot ${x.tone}`} /><span>{x.text}</span>{x.href ? <Link className="btn ghost" href={x.href}>{x.action}</Link> : <button className="btn ghost">{x.action}</button>}</li>))}</ul>
          </section>
          <section className="card"><h2>طلباتك النشطة</h2>{d.requests.length === 0 && <p className="muted">لا توجد طلبات مفتوحة.</p>}
            <ul className="list">{d.requests.map((r) => (
              <li key={r.id}><b className="logo sm ltr">{r.airline}</b><span><Link href={`/requests?id=${r.id}`}>{r.title}</Link><small className="muted">{r.next}</small></span><em className={`tag ${r.tone}`}>{r.status}</em></li>))}</ul>
          </section>
          <section className="card"><h2>إجراءات سريعة</h2>
            <div className="stack"><Link className="btn gold" href="/inbox">+ طلب جديد من إيميل</Link><Link className="btn ghost" href="/inbox">افتح الوارد</Link><Link className="btn ghost" href="/requests">ملفات الطلبات</Link><Link className="btn ghost" href="/agent">سجل محادثة الوكيل</Link></div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
