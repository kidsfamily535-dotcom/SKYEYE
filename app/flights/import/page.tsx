import Link from "next/link";
import Shell from "@/components/Shell";
import ProgramImport from "@/components/ProgramImport";
import { getCommandData } from "@/lib/data";
import { getImportContext } from "@/lib/program";

export default async function ImportPage() {
  const [d, c] = await Promise.all([getCommandData(), getImportContext()]);
  return (
    <Shell data={d}>
      <main className="page">
        <section className="card" aria-label="رفع برنامج الرحلات">
          <div className="row"><h2 className="grow">رفع برنامج الرحلات</h2><Link className="btn sm" href="/flights">رجوع للرحلات</Link></div>
          {!c && <p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p>}
          {c && !c.canWrite && <p role="alert" className="err">حسابك للمشاهدة فقط، فلا يمكنك رفع برنامج الرحلات.</p>}
          {c && c.canWrite && <ProgramImport canAdmin={c.canAdmin} />}
        </section>
        {c && c.canWrite && (
          <section className="card" aria-label="المضبوط لشركتك">
            <h2>المضبوط لشركتك</h2>
            <small className="muted">لا تُقبل رحلة إلا لمحطة وشركة طيران مضافتين هنا.</small>
            <p>المحطات: <span className="ltr">{c.stations.length ? c.stations.join(" ") : "—"}</span></p>
            <p>شركات الطيران: <span className="ltr">{c.airlines.length ? c.airlines.join(" ") : "—"}</span></p>
          </section>
        )}
      </main>
    </Shell>
  );
}
