import Shell from "@/components/Shell";
import Hint from "@/components/Hint";
import ShiftDefinitionForm from "@/components/ShiftDefinitionForm";
import { getCommandData } from "@/lib/data";
import { getShiftPage, hhmm } from "@/lib/shifts";
import { getPolicies } from "@/lib/requests";

const POLICY_AR: Record<string, string> = { warn_before_hours: "تنبيه قبل موعد الطلب", urgent_hours: "ما يُعدّ عاجلاً قبل الرحلة", lead_time_hours: "المهلة الطبيعية قبل الرحلة", stall_after_hours: "الطلب الراكد بعد" };

export default async function SettingsPage() {
  const [d, p, policies] = await Promise.all([getCommandData(), getShiftPage(undefined), getPolicies()]);
  return (
    <Shell data={d}>
      <main className="page">
        {!p && <section className="card"><p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p></section>}
        {p && (
          <div className="cols2">
            <section className="card" aria-label="الورديات">
              <h2>الورديات<Hint>لا أفترض مواعيد الوردية: يحددها المسؤول، ومنها يُولَّد تقرير التسليم.</Hint></h2>
              {p.defs.length === 0 && <p className="muted">لم تُعرَّف أي وردية بعد، فلا يُولَّد أي تقرير.</p>}
              <ul className="list">
                {p.defs.map((s) => (
                  <li key={s.id}><i className={`dot ${s.active ? "ok" : "info"}`} /><span><bdi>{s.name}</bdi><small className="muted">تبدأ <span className="ltr">{hhmm(s.startMinute)}</span> UTC · مدتها <span className="ltr">{Math.round((s.durationMinutes / 60) * 10) / 10}</span> ساعة{s.active ? "" : " · متوقفة"}</small></span></li>
                ))}
              </ul>
              {p.canAdmin
                ? <details className="fold"><summary className="btn sm">{p.defs.length === 0 ? "عرّف الوردية الأولى" : "أضف أو عدّل وردية"}</summary><ShiftDefinitionForm companyId={p.companyId} /></details>
                : p.defs.length === 0 && <p className="muted">اطلب من المسؤول تعريف الورديات.</p>}
            </section>

            <section className="card" aria-label="مهل الطلبات">
              <h2>مهل الطلبات<Hint>لا يُولَّد تنبيه إلا بمهلة معتمدة. غير المعتمد يظهر «—» ولا أفترض له رقماً.</Hint></h2>
              <ul className="list">{policies.map((q, i) => (
                <li key={i}><i className={`dot ${q.status === "approved" ? "ok" : "warn"}`} /><span>{POLICY_AR[q.kind] ?? q.kind}</span><b className="ltr">{q.hours === null ? "—" : `${q.hours}h`}</b><em className={`tag ${q.status === "approved" ? "ok" : "warn"}`}>{q.status === "approved" ? "معتمدة" : "بانتظار الاعتماد"}</em></li>))}</ul>
            </section>
          </div>
        )}
      </main>
    </Shell>
  );
}
