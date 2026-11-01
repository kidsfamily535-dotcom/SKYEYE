import Shell from "@/components/Shell";
import AgentComposer from "@/components/AgentComposer";
import AgentCancel from "@/components/AgentCancel";
import AgentRefresh from "@/components/AgentRefresh";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { answerText, getAgentPage, CMD_AR, STATUS_AR, TARGET_AR } from "@/lib/agent";

const TONE: Record<string, string> = { queued: "warn", running: "info", done: "ok", failed: "late", cancelled: "info" };

export default async function AgentPage() {
  const [d, p] = await Promise.all([getCommandData(), getAgentPage()]);
  return (
    <Shell data={d}>
      <main className="page">
        {!p && <section className="card"><p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p></section>}
        {p && (
          <>
            <AgentRefresh active={p.active > 0} />
            <div className="inbox">
              <section className="card" aria-label="رسالة جديدة">
                <h2>كلّم الوكيل</h2>
                {p.canWrite ? <AgentComposer companyId={p.companyId} opts={p.opts} /> : <p className="muted">صلاحية المشاهدة لا تسمح بإرسال أوامر للوكيل.</p>}
              </section>

              <section className="detail" aria-label="المحادثة">
                <div className="card">
                  <h2>المحادثة</h2>
                  {p.active > 0 && <p className="muted">{p.active} أمر بانتظار الوكيل أو قيد التنفيذ، وتتحدث الشاشة تلقائياً.</p>}
                  {p.commands.length === 0 && <p className="muted">لا رسائل بعد. اختر موضوعاً من اليمين واكتب للوكيل.</p>}
                  <ol className="chat">
                    {p.commands.map((c) => {
                      const ans = c.status === "done" ? answerText(c.result) : null;
                      return (
                        <li key={c.id}>
                          <div className="bubble me">
                            <b>{CMD_AR[c.type] ?? c.type}</b>
                            <small className="muted">{TARGET_AR[c.targetType] ?? c.targetType}{c.targetLabel ? <>: <bdi className="ltr">{c.targetLabel}</bdi></> : ""} · <span className="ltr">{fmtUtc(c.createdAt)}</span></small>
                            {c.instruction && <p><bdi>{c.instruction}</bdi></p>}
                          </div>
                          <div className="bubble agent">
                            <span className={`tag ${TONE[c.status] ?? "info"}`}>{STATUS_AR[c.status] ?? c.status}</span>
                            {c.status === "queued" && <small className="muted">لم يأخذه الوكيل بعد.</small>}
                            {c.status === "done" && (ans ? <p><bdi>{ans}</bdi></p> : <small className="muted">نفّذه الوكيل{c.result ? " ولم يكتب نصاً للرد." : "."}</small>)}
                            {c.status === "done" && !ans && c.result ? <details><summary className="muted">تفاصيل النتيجة</summary><pre className="ltr raw">{JSON.stringify(c.result, null, 2)}</pre></details> : null}
                            {c.status === "failed" && <small className="err">{c.error ?? "فشل التنفيذ دون سبب مسجّل."}</small>}
                            {c.finishedAt && <small className="muted ltr">{fmtUtc(c.finishedAt)}</small>}
                            {c.status === "queued" && p.canWrite && <AgentCancel companyId={p.companyId} commandId={c.id} />}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}
