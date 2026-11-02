import { stepName } from "@/lib/step-name";
import type { FlightMail, FlightRqm, Question, Statement, StepRow } from "@/lib/flights";
import type { Lang, TFn } from "@/lib/i18n";

export type FeedItem = { id: string; at: string | null; kind: "step" | "mail" | "draft" | "statement" | "question"; tone: "ok" | "info" | "warn" | "late"; title: string; detail?: string; href?: string };
export type NextStep = { tone: "ok" | "info" | "warn" | "late"; text: string; href?: string; action?: string };

type Input = { steps: StepRow[]; questions: Question[]; statements: Statement[]; mails: FlightMail[]; rqms?: FlightRqm[]; criticalOpen: number };

/** Everything here comes from recorded data. Nothing is guessed: no time or reason is invented. */
export function buildFeed({ steps, questions, statements, mails }: Input, t: TFn, lang: Lang) {
  const waiting: FeedItem[] = [];
  const done: FeedItem[] = [];
  for (const q of questions) waiting.push({ id: `q-${q.id}`, at: q.dueAt, kind: "question", tone: q.status === "late" || q.status === "escalated" ? "late" : "warn", title: q.text, detail: q.status === "late" ? t("q.late") : undefined });
  for (const m of mails) {
    if (m.draft?.status === "draft") waiting.push({ id: `d-${m.draft.id}`, at: m.draft.at, kind: "draft", tone: "warn", title: t("fl.f.draftWait"), detail: m.subject ?? undefined, href: `/inbox?id=${m.triageId}` });
    done.push({ id: `m-${m.triageId}`, at: m.at, kind: "mail", tone: m.status === "new" ? "info" : "ok", title: m.summary ?? m.subject ?? t("fl.mail.fallback"), detail: [m.from, m.action].filter(Boolean).join(" · ") || undefined, href: `/inbox?id=${m.triageId}` });
  }
  for (const s of steps) if (s.state === "recorded" && s.actualAt) done.push({ id: `s-${s.track}-${s.code}`, at: s.actualAt, kind: "step", tone: "ok", title: stepName(s, lang), detail: s.code });
  const planned = steps.filter((s) => s.state !== "recorded" && s.plannedAt && s.templateStatus === "approved").sort((a, b) => +new Date(a.plannedAt!) - +new Date(b.plannedAt!)).slice(0, 5);
  for (const s of planned) waiting.push({ id: `p-${s.track}-${s.code}`, at: s.plannedAt, kind: "step", tone: "info", title: stepName(s, lang), detail: s.isCritical ? t("fl.f.critical") : undefined });
  for (const s of statements) done.push({ id: `st-${s.id}`, at: s.at, kind: "statement", tone: "warn", title: t("fl.f.statement", { reason: s.reason }), detail: [s.code, s.minutes !== null ? t("fl.min", { n: s.minutes }) : null, s.by].filter(Boolean).join(" · ") || undefined });
  const ms = (x: FeedItem) => (x.at ? +new Date(x.at) : 0);
  waiting.sort((a, b) => ms(a) - ms(b));
  done.sort((a, b) => ms(b) - ms(a));
  return { waiting, done };
}

export function nextStep({ questions, mails, rqms = [], criticalOpen }: Input, t: TFn): NextStep {
  const rq = rqms.find((x) => !x.sentAt);
  const wait = rqms.find((x) => x.sentAt);
  const late = questions.find((q) => q.status === "late" || q.status === "escalated");
  if (late) return { tone: "late", text: t("fl.n.late", { text: late.text }), href: "#questions", action: t("fl.n.answer") };
  if (rq) return { tone: "warn", text: rq.followup ? t("fl.n.rqmFollow") : t("fl.n.rqmNew"), href: "#rqm", action: t("fl.n.reviewDraft") };
  const q = questions[0];
  if (q) return { tone: "warn", text: t("fl.n.agentWaits", { text: q.text }), href: "#questions", action: t("fl.n.answer") };
  const draft = mails.find((m) => m.draft?.status === "draft");
  if (draft) return { tone: "warn", text: t("fl.n.draftReady"), href: `/inbox?id=${draft.triageId}`, action: t("fl.n.reviewDraft") };
  const fresh = mails.find((m) => m.status === "new");
  if (fresh) return { tone: "info", text: t("fl.n.newMail"), href: `/inbox?id=${fresh.triageId}`, action: t("fl.n.openMail") };
  if (criticalOpen > 0) return { tone: "warn", text: t("fl.n.critical", { n: criticalOpen }), href: "?view=handling", action: t("fl.n.openSteps") };
  if (wait) return { tone: "info", text: t("fl.n.rqmSent") };
  return { tone: "ok", text: t("fl.n.allClear") };
}
