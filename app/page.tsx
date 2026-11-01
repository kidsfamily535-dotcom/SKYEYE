import Shell from "@/components/Shell";
import Radar from "@/components/Radar";
import { getCommandData } from "@/lib/data";

const dash = (n: number | null) => (n ?? "—");

export default async function CommandPage() {
  const d = await getCommandData();
  return (
    <Shell data={d}>
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

        <div className="cols">
          <section className="card"><h2>الوكيل يقول لك</h2>{d.isSample && <small className="muted">أمثلة توضيحية حتى ربط البيانات</small>}
            <ul className="list">{d.decisions.map((x) => (
              <li key={x.id}><i className={`dot ${x.tone}`} /><span>{x.text}</span><button className="btn ghost">{x.action}</button></li>))}</ul>
          </section>
          <section className="card"><h2>طلباتك النشطة</h2>
            <ul className="list">{d.requests.map((r) => (
              <li key={r.id}><b className="logo sm ltr">{r.airline}</b><span>{r.title}<small className="muted">{r.next}</small></span><em className={`tag ${r.tone}`}>{r.status}</em></li>))}</ul>
          </section>
          <section className="card"><h2>إجراءات سريعة</h2>
            <div className="stack"><button className="btn gold">+ طلب جديد</button><button className="btn ghost" disabled>افتح الوارد</button><button className="btn ghost" disabled>تقرير الوردية</button><button className="btn ghost" disabled>كلّم الوكيل</button></div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
