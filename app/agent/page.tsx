import Shell from "@/components/Shell";
import AgentComposer from "@/components/AgentComposer";
import AgentCancel from "@/components/AgentCancel";
import AgentLive from "@/components/AgentLive";
import ChatDock from "@/components/ChatDock";
import ChatScroll from "@/components/ChatScroll";
import Hint from "@/components/Hint";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { answerText, draftTextOf, getAgentPage, sourcesOf, missingOf, CMD_AR, STATUS_AR, TARGET_AR } from "@/lib/agent";

const TONE: Record<string, string> = { queued: "warn", running: "info", done: "ok", failed: "late", cancelled: "info" };
const clean = (t: string) => t.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ flight?: string }> }) {
  const sp = await searchParams;
  const [d, p] = await Promise.all([getCommandData(), getAgentPage({ flight: sp.flight })]);
  return (
    <Shell data={d}>
      <main className="page">
        {!p && <section className="card"><p className="muted">حسابك غير مرتبط بشركة بعد. اطلب من المسؤول إضافتك.</p></section>}
        {p && (
          <>
            <AgentLive companyId={p.companyId} active={p.active > 0} />
            <section className="card chatshell" aria-label="المحادثة مع الوكيل">
              <header className="chathead">
                <div><h2>كلّم الوكيل<Hint>الوكيل بيرد من بيانات الشركة المسجّلة فعلاً ولا يخمّن أي وقت. لا يرسل شيئاً خارج الشركة: كل ما يجهّزه مسودة تراجعها وتبعتها أنت. المحادثة مشتركة بين موظفي الشركة.</Hint></h2></div>
                <span className="tag ok">متصل</span>
              </header>
              <div className="chatscroll" role="log" aria-live="polite">
                {p.commands.length === 0 && <p className="muted empty">ابدأ بسؤال زي «إيه اللي عندي النهاردة؟» وهرد عليك من بيانات الشركة.</p>}
                <ol className="chat">
                  {p.commands.map((c) => {
                    const ans = c.status === "done" ? answerText(c.result) : null;
                    const drafted = c.status === "done" ? draftTextOf(c.result) : null;
                    const busy = c.status === "queued" || c.status === "running";
                    return (
                      <li key={c.id}>
                        <div className="bubble me">
                          <small className="muted">{c.mine ? "أنت" : c.senderName ?? "زميل"} · <span className="ltr">{fmtUtc(c.createdAt)}</span></small>
                          {c.type !== "answer_question" && <b>{CMD_AR[c.type] ?? c.type}</b>}
                          {c.targetType !== "company" && <small className="muted">{TARGET_AR[c.targetType] ?? c.targetType}{c.targetLabel ? <>: <bdi className="ltr">{c.targetLabel}</bdi></> : ""}</small>}
                          {c.instruction && <p><bdi>{c.instruction}</bdi></p>}
                        </div>
                        <div className="bubble agent">
                          <small className="muted">SKYEYE</small>
                          {busy && <span className="typing" role="status" aria-label={c.status === "queued" ? "الوكيل لسه ما استلمش" : "الوكيل بيكتب"}><i /><i /><i /></span>}
                          {c.status === "queued" && <small className="muted">في الطابور…</small>}
                          {c.status === "running" && <small className="muted">الوكيل بيكتب…</small>}
                          {c.status === "cancelled" && <span className="tag info">{STATUS_AR.cancelled}</span>}
                          {c.status === "done" && ans && <p><bdi>{clean(ans)}</bdi></p>}
                          {c.status === "done" && drafted && <><small className="muted">مسودة جاهزة. تُنسخ وتُرسل من بريد الشركة، والوكيل لا يرسل:</small><pre className="ltr raw">{drafted}</pre></>}
                          {c.status === "done" && !ans && !drafted && <small className="muted">نفّذه الوكيل{c.result ? " ولم يكتب نصاً للرد." : "."}</small>}
                          {c.status === "done" && missingOf(c.result).length > 0 && <small className="muted">ينقص: <bdi className="ltr">{missingOf(c.result).join("، ")}</bdi></small>}
                          {c.status === "done" && sourcesOf(c.result).length > 0 && <small className="muted">المصادر: <bdi className="ltr">{sourcesOf(c.result).join(" · ")}</bdi></small>}
                          {c.status === "done" && !ans && !drafted && c.result ? <details><summary className="muted">تفاصيل النتيجة</summary><pre className="ltr raw">{JSON.stringify(c.result, null, 2)}</pre></details> : null}
                          {c.status === "failed" && <small className="err">{c.error ?? "فشل التنفيذ دون سبب مسجّل."} حاول تبعت السؤال تاني.</small>}
                          {c.status === "queued" && p.canWrite && <AgentCancel companyId={p.companyId} commandId={c.id} />}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <ChatScroll signal={p.commands.map((c) => `${c.id}:${c.status}`).join("|")} />
              </div>
              <ChatDock companyId={p.companyId} opts={p.opts} initial={p.ctx} canWrite={p.canWrite} />
            </section>

            {p.canWrite && (
              <details className="fold card">
                <summary className="btn ghost">أوامر متقدمة للوكيل</summary>
                <AgentComposer companyId={p.companyId} opts={p.opts} />
              </details>
            )}
          </>
        )}
      </main>
    </Shell>
  );
}
