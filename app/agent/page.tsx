import Shell from "@/components/Shell";
import AgentComposer from "@/components/AgentComposer";
import AgentCancel from "@/components/AgentCancel";
import AgentLive from "@/components/AgentLive";
import ChatDock from "@/components/ChatDock";
import ChatScroll from "@/components/ChatScroll";
import Hint from "@/components/Hint";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import { answerText, draftTextOf, getAgentPage, sourcesOf, missingOf } from "@/lib/agent";
import { getT } from "@/lib/lang";
import { labelOf } from "@/lib/i18n";

const TONE: Record<string, string> = { queued: "warn", running: "info", done: "ok", failed: "late", cancelled: "info" };
const clean = (s: string) => s.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");

export default async function AgentPage({ searchParams }: { searchParams: Promise<{ flight?: string }> }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const [d, p] = await Promise.all([getCommandData(), getAgentPage({ flight: sp.flight })]);
  return (
    <Shell data={d}>
      <main className="page">
        {!p && <section className="card"><p className="muted">{t("home.noMembership")}</p></section>}
        {p && (
          <>
            <AgentLive companyId={p.companyId} active={p.active > 0} />
            <section className="card chatshell" aria-label={t("agent.chat.aria")}>
              <header className="chathead">
                <div><h2>{t("nav.agent")}<Hint>{t("agent.hint")}</Hint></h2></div>
                <span className="tag ok">{t("agent.online")}</span>
              </header>
              <div className="chatscroll" role="log" aria-live="polite">
                {p.commands.length === 0 && <p className="muted empty">{t("agent.empty")}</p>}
                <ol className="chat">
                  {p.commands.map((c) => {
                    const ans = c.status === "done" ? answerText(c.result) : null;
                    const drafted = c.status === "done" ? draftTextOf(c.result) : null;
                    const busy = c.status === "queued" || c.status === "running";
                    return (
                      <li key={c.id}>
                        <div className="bubble me">
                          <small className="muted">{c.mine ? t("agent.you") : c.senderName ?? t("agent.colleague")} · <span className="ltr">{fmtUtc(c.createdAt)}</span></small>
                          {c.type !== "answer_question" && <b>{labelOf(lang, "agent.cmd", c.type)}</b>}
                          {c.targetType !== "company" && <small className="muted">{labelOf(lang, "agent.target", c.targetType)}{c.targetLabel ? <>: <bdi className="ltr">{c.targetLabel}</bdi></> : ""}</small>}
                          {c.instruction && <p><bdi>{c.instruction}</bdi></p>}
                        </div>
                        <div className="bubble agent">
                          <small className="muted">SKYEYE</small>
                          {busy && <span className="typing" role="status" aria-label={c.status === "queued" ? t("agent.typing.queued") : t("agent.typing.running")}><i /><i /><i /></span>}
                          {c.status === "queued" && <small className="muted">{t("agent.inQueue")}</small>}
                          {c.status === "running" && <small className="muted">{t("agent.writing")}</small>}
                          {c.status === "cancelled" && <span className="tag info">{t("agent.status.cancelled")}</span>}
                          {c.status === "done" && ans && <p><bdi>{clean(ans)}</bdi></p>}
                          {c.status === "done" && drafted && <><small className="muted">{t("agent.draftReady")}</small><pre className="ltr raw">{drafted}</pre></>}
                          {c.status === "done" && !ans && !drafted && <small className="muted">{c.result ? t("agent.doneNoText") : t("agent.done")}</small>}
                          {c.status === "done" && missingOf(c.result).length > 0 && <small className="muted">{t("agent.missing")} <bdi className="ltr">{missingOf(c.result).join(t("imp.sep"))}</bdi></small>}
                          {c.status === "done" && sourcesOf(c.result).length > 0 && <small className="muted">{t("agent.sources")} <bdi className="ltr">{sourcesOf(c.result).join(" · ")}</bdi></small>}
                          {c.status === "done" && !ans && !drafted && c.result ? <details><summary className="muted">{t("agent.details")}</summary><pre className="ltr raw">{JSON.stringify(c.result, null, 2)}</pre></details> : null}
                          {c.status === "failed" && <small className="err">{c.error ?? t("agent.failed")} {t("agent.retry")}</small>}
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
                <summary className="btn ghost">{t("agent.advanced")}</summary>
                <AgentComposer companyId={p.companyId} opts={p.opts} />
              </details>
            )}
          </>
        )}
      </main>
    </Shell>
  );
}
