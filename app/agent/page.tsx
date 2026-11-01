import Shell from "@/components/Shell";
import AgentComposer from "@/components/AgentComposer";
import AgentCancel from "@/components/AgentCancel";
import AgentRefresh from "@/components/AgentRefresh";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { answerText, getAgentPage } from "@/lib/agent";
import { AGENT_STATUS_AR, AGENT_STATUS_TONE, AGENT_TARGET_AR, CMD_AR } from "@/lib/labels";
import { PageHeader, Split, Tag, Empty, NoCompany } from "@/components/ui";

export default async function AgentPage() {
  const [d, p] = await Promise.all([getCommandData(), getAgentPage()]);
  return (
    <Shell data={d}>
      <main className="page">
        <PageHeader title="كلّم الوكيل" subtitle="اختر الموضوع واكتب للوكيل؛ رده يظهر هنا في المحادثة." />
        {!p && <NoCompany />}
        {p && (
          <>
            <AgentRefresh active={p.active > 0} />
            <Split>
              <section className="card" aria-label="رسالة جديدة">
                <h2>كلّم الوكيل</h2>
                {p.canWrite ? <AgentComposer companyId={p.companyId} opts={p.opts} /> : <Empty>صلاحية المشاهدة لا تسمح بإرسال أوامر للوكيل.</Empty>}
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
                            <small className="muted">{AGENT_TARGET_AR[c.targetType] ?? c.targetType}{c.targetLabel ? <>: <bdi className="ltr">{c.targetLabel}</bdi></> : ""} · <span className="ltr">{fmtUtc(c.createdAt)}</span></small>
                            {c.instruction && <p><bdi>{c.instruction}</bdi></p>}
                          </div>
                          <div className="bubble agent">
                            <Tag tone={AGENT_STATUS_TONE[c.status] ?? "info"}>{AGENT_STATUS_AR[c.status] ?? c.status}</Tag>
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
            </Split>
          </>
        )}
      </main>
    </Shell>
  );
}
