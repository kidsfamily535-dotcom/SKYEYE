import type { FlightMail, FlightRqm, Question, Statement, StepRow } from "@/lib/flights";

export type FeedItem = { id: string; at: string | null; kind: "step" | "mail" | "draft" | "statement" | "question"; tone: "ok" | "info" | "warn" | "late"; title: string; detail?: string; href?: string };
export type NextStep = { tone: "ok" | "info" | "warn" | "late"; text: string; href?: string; action?: string };

type Input = { steps: StepRow[]; questions: Question[]; statements: Statement[]; mails: FlightMail[]; rqms?: FlightRqm[]; criticalOpen: number };

/** Everything here comes from recorded data. Nothing is guessed: no time or reason is invented. */
export function buildFeed({ steps, questions, statements, mails }: Input) {
  const waiting: FeedItem[] = [];
  const done: FeedItem[] = [];
  for (const q of questions) waiting.push({ id: `q-${q.id}`, at: q.dueAt, kind: "question", tone: q.status === "late" || q.status === "escalated" ? "late" : "warn", title: q.text, detail: q.status === "late" ? "متأخر" : undefined });
  for (const m of mails) {
    if (m.draft?.status === "draft") waiting.push({ id: `d-${m.draft.id}`, at: m.draft.at, kind: "draft", tone: "warn", title: "مسودة رد بانتظار مراجعتك", detail: m.subject ?? undefined, href: `/inbox?id=${m.triageId}` });
    done.push({ id: `m-${m.triageId}`, at: m.at, kind: "mail", tone: m.status === "new" ? "info" : "ok", title: m.summary ?? m.subject ?? "إيميل", detail: [m.from, m.action].filter(Boolean).join(" · ") || undefined, href: `/inbox?id=${m.triageId}` });
  }
  for (const s of steps) if (s.state === "recorded" && s.actualAt) done.push({ id: `s-${s.track}-${s.code}`, at: s.actualAt, kind: "step", tone: "ok", title: s.nameAr, detail: s.code });
  for (const s of statements) done.push({ id: `st-${s.id}`, at: s.at, kind: "statement", tone: "warn", title: `إفادة تأخير: ${s.reason}`, detail: [s.code, s.minutes !== null ? `${s.minutes} د` : null, s.by].filter(Boolean).join(" · ") || undefined });
  const t = (x: FeedItem) => (x.at ? +new Date(x.at) : 0);
  waiting.sort((a, b) => t(a) - t(b));
  done.sort((a, b) => t(b) - t(a));
  return { waiting, done };
}

export function nextStep({ questions, mails, rqms = [], criticalOpen }: Input): NextStep {
  const rq = rqms.find((x) => !x.sentAt);
  const wait = rqms.find((x) => x.sentAt);
  const late = questions.find((q) => q.status === "late" || q.status === "escalated");
  if (late) return { tone: "late", text: `متأخر: ${late.text}`, href: "#questions", action: "أجب الآن" };
  if (rq) return { tone: "warn", text: rq.followup ? "مسودة متابعة RQM جاهزة: لم يصل رد على الاستفسار." : "لم تصل رسالة المغادرة (AD). جهّزت لك استفسار RQM.", href: "#rqm", action: "راجع المسودة" };
  const q = questions[0];
  if (q) return { tone: "warn", text: `الوكيل ينتظر: ${q.text}`, href: "#questions", action: "أجب الآن" };
  const draft = mails.find((m) => m.draft?.status === "draft");
  if (draft) return { tone: "warn", text: "مسودة رد جاهزة لمراجعتك واعتمادك.", href: `/inbox?id=${draft.triageId}`, action: "راجع المسودة" };
  const fresh = mails.find((m) => m.status === "new");
  if (fresh) return { tone: "info", text: "وصل إيميل مرتبط بهذه الرحلة ولم تراجعه.", href: `/inbox?id=${fresh.triageId}`, action: "افتح الإيميل" };
  if (criticalOpen > 0) return { tone: "warn", text: `مراحل حرجة مفتوحة: ${criticalOpen}`, href: "?view=timeline", action: "افتح المراحل" };
  if (wait) return { tone: "info", text: "أُرسل استفسار RQM. الوكيل ينتظر الرد ويجهّز متابعة بعد 15 دقيقة من الإرسال إن لم يصل." };
  return { tone: "ok", text: "لا شيء يحتاج قرارك الآن. الوكيل يتابع الرحلة." };
}
