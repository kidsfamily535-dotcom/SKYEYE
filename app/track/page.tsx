import Shell from "@/components/Shell";
import Hint from "@/components/Hint";
import TrackForm from "@/components/TrackForm";
import { getCommandData } from "@/lib/data";

export default async function TrackPage() {
  const d = await getCommandData();
  return (
    <Shell data={d}>
      <main className="page">
        <section className="card" aria-label="تتبع طائرة">
          <h2>تتبع طائرة<Hint>اكتب رقم تسجيل الطائرة (مثلاً SU-GEK) وهتشوف مكانها دلوقتي من شبكات ADS-B المجتمعية. للقراءة فقط: لا يُرسل ولا يُسجَّل شيء. الوكيل في «كلّم الوكيل» يعمل نفس الشيء لما تسأله «SU-GEK فين؟».</Hint></h2>
          {d.noMembership ? <p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p> : <TrackForm />}
        </section>
      </main>
    </Shell>
  );
}
