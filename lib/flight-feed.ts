import { stepName } from "@/lib/step-name";
import type { FlightMail, FlightRqm, Question, Statement, StepRow } from "@/lib/flights";
import type { Lang, TFn } from "@/lib/i18n";

export type FeedItem = { id: string; at: string | null; kind: "step" | "mail" | "draft" | "statement" | "question"; tone: "ok" | "info" | "warn" | "late"; title: string; detail?: string; href?: string };
export type NextStep = { tone: "ok" | "info" | "warn" | "late"; text: string; href?: string; action?: string };

type Input = { steps: StepRow[]; questions: Question[]; statements: Statement[]; mails: FlightMail[]; rqms?: FlightRqm[]; criticalOpen: number };

/** Chronology only (planned steps ahead, recorded steps, mails, statements). Open agent questions are NOT here: they have their own card in "needed now", so each fact has one home. Nothing is guessed. */
export function buildFeed({ steps, statements, mails }: Input, t: TFn, lang: Lang) {
  const waiting: FeedItem[] = [];
  const done: FeedItem[] = [];
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

type Raw = Record<string, any>;

/** Adds the arrival and departure markers to the chronology (actual if recorded, else expected/scheduled). */
export function withEndpoints(feed: { waiting: FeedItem[]; done: FeedItem[] }, f: Raw, c: Raw, t: TFn) {
  const ev = (id: string, title: string, actual: unknown, expected: unknown): FeedItem | null => {
    const at = (actual ?? expected) ? String(actual ?? expected) : null; if (!at) return null;
    return { id, at, kind: "step", tone: actual ? "ok" : "info", title };
  };
  const arr = ev("ev-arr", t("fl.j.arrival"), f.ata, f.eta ?? f.sta);
  const dep = ev("ev-dep", t("fl.j.departure"), f.atd, c.expected_std ?? f.std);
  if (arr) (f.ata ? feed.done : feed.waiting).push(arr);
  if (dep) (f.atd ? feed.done : feed.waiting).push(dep);
  const ms = (x: FeedItem) => (x.at ? +new Date(x.at) : 0);
  feed.waiting.sort((a, b) => ms(a) - ms(b)); feed.done.sort((a, b) => ms(b) - ms(a));
  return feed;
}

/** Audit trail: who recorded / corrected / stated what, newest first. */
export function buildAudit(sel: { steps: StepRow[]; statements: Statement[]; rqms: FlightRqm[] }, t: TFn, lang: Lang): FeedItem[] {
  return [
    ...sel.steps.filter((x) => x.state === "recorded" && x.actualAt).map((x) => ({ id: `a-${x.track}-${x.code}`, at: x.actualAt, kind: "step" as const, tone: x.wasCorrected ? "warn" as const : "ok" as const, title: t(x.wasCorrected ? "fl.audit.corrected" : "fl.audit.recorded", { name: stepName(x, lang) }), detail: [x.code, x.by].filter(Boolean).join(" · ") })),
    ...sel.statements.map((x) => ({ id: `a-st-${x.id}`, at: x.at, kind: "statement" as const, tone: "warn" as const, title: t("fl.audit.statement", { reason: x.reason }), detail: [x.code, x.by].filter(Boolean).join(" · ") })),
    ...sel.rqms.filter((x) => x.sentAt).map((x) => ({ id: `a-rq-${x.id}`, at: x.sentAt, kind: "draft" as const, tone: "info" as const, title: t(x.followup ? "fl.audit.rqmFollow" : "fl.audit.rqm"), detail: undefined })),
  ].sort((a, b) => +new Date(b.at ?? 0) - +new Date(a.at ?? 0));
}
