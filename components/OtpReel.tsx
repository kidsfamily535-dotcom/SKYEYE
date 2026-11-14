"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/I18n";
import { fmtUtc } from "@/lib/format";
import { labelOf } from "@/lib/i18n";
import { stepName } from "@/lib/step-name";
import { reelLoadCc } from "@/app/flights/reel-actions";
import type { CommandCenter, CcStep } from "@/lib/command-center";
import type { StepRow } from "@/lib/flights";

// "Flight reel": the flight's story as horizontal film strips under the stand scene. One strip per subject
// (flight timeline, handling stages, movement messages, documents). Every frame opens a glass card with its details.
// Read-only: it shows what the database already holds; recording and editing stay in the existing sections.

export type ReelItem = { id: string; at: string | null; tone: "ok" | "info" | "warn" | "late"; title: string; detail?: string; href?: string; done: boolean };
type Props = { rotationId: string; arrivalLeg: string; flight: ReelItem[]; steps: StepRow[] };
type Tone = "done" | "warn" | "late" | "future" | "dim";
type Frame = { id: string; title: string; sub?: string; tone: Tone; badge?: string };
type Lane = "flight" | "handling" | "movement" | "docs";
type CcState = { s: "idle" | "load" | "ok" | "err"; data?: CommandCenter };

const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "");
const ms = (iso: string | null | undefined) => (iso ? +new Date(iso) : null);

function Strip({ label, count, frames, nowAt, sel, onPick, note }: { label: string; count?: number; frames: Frame[]; nowAt: number | null; sel: string | null; onPick: (id: string) => void; note?: string }) {
  const { t } = useT();
  const sc = useRef<HTMLDivElement>(null);
  const centred = useRef(false);
  useEffect(() => {
    const el = sc.current; if (!el || centred.current || frames.length === 0) return;
    const target = el.querySelector<HTMLElement>(".otr-now") ?? el.querySelector<HTMLElement>(".otr-f.warn, .otr-f.late");
    if (!target) return;
    centred.current = true;
    el.scrollLeft = target.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - el.clientWidth / 2 + target.offsetWidth / 2;
  }, [frames]);
  return (
    <div className="otr-lane">
      <div className="otr-lbl"><b>{label}</b>{typeof count === "number" && count > 0 && <small className="ltr">{count}</small>}</div>
      {frames.length === 0 ? <p className="otr-empty">{note ?? t("reel.empty")}</p> : (
        <div className="otr-scroll" ref={sc} role="list">
          <div className="otr-track">
            {frames.map((f, i) => (
              <span key={f.id} style={{ display: "contents" }}>
                {nowAt === i && <span className="otr-now" aria-label={t("reel.now")}><i /><em>{t("reel.now")}</em></span>}
                <button type="button" role="listitem" className={`otr-f ${f.tone}${sel === f.id ? " sel" : ""}`} onClick={() => onPick(f.id)} aria-pressed={sel === f.id}>
                  <span className="d">{f.badge && <span className="bd">{f.badge}</span>}</span>
                  <b dir="auto">{f.title}</b>
                  {f.sub && <small className="ltr">{f.sub}</small>}
                </button>
              </span>
            ))}
            {nowAt === frames.length && <span className="otr-now" aria-label={t("reel.now")}><i /><em>{t("reel.now")}</em></span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OtpReel({ rotationId, arrivalLeg, flight, steps }: Props) {
  const { t, lang } = useT();
  const [sel, setSel] = useState<{ lane: Lane; id: string } | null>(null);
  const [cc, setCc] = useState<CcState>({ s: "idle" });
  const [copied, setCopied] = useState(false);
  const host = useRef<HTMLElement>(null);

  // Movement messages and documents come from one heavy database call: load it once, when the reel is first seen.
  useEffect(() => {
    const el = host.current; if (!el || cc.s !== "idle") return;
    const go = () => { setCc({ s: "load" }); reelLoadCc(arrivalLeg).then((r) => setCc(r.ok ? { s: "ok", data: r.data } : { s: "err" })).catch(() => setCc({ s: "err" })); };
    if (typeof IntersectionObserver === "undefined") { go(); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "240px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cc.s, arrivalLeg]);

  /* ---- strip 1: the flight timeline (arrival, mails, statements, planned steps, departure) ---- */
  const fFrames: Frame[] = useMemo(() => flight.map((x) => ({
    id: x.id, title: x.title, sub: hm(x.at),
    tone: x.done ? "done" : x.tone === "warn" ? "warn" : x.tone === "late" ? "late" : "future",
  })), [flight]);
  const fNow = useMemo(() => { const i = flight.findIndex((x) => !x.done); return i === -1 ? (flight.length > 0 ? flight.length : null) : i; }, [flight]);

  /* ---- strip 2: handling stages ---- */
  const sorted = useMemo(() => [...steps].sort((a, b) => (ms(a.actualAt ?? a.plannedAt) ?? Infinity) - (ms(b.actualAt ?? b.plannedAt) ?? Infinity) || a.seq - b.seq), [steps]);
  const sFrames: Frame[] = useMemo(() => sorted.map((s) => ({
    id: `${s.track}-${s.code}`, title: stepName(s, lang), sub: hm(s.actualAt ?? s.plannedAt),
    tone: s.state === "recorded" ? "done" : s.state === "open" ? "warn" : "future",
    badge: s.state === "recorded" && s.variance !== null && s.variance >= 3 ? `+${s.variance}` : undefined,
  })), [sorted, lang]);
  const sNow = useMemo(() => { const i = sorted.findIndex((s) => s.state !== "recorded"); return i === -1 ? (sorted.length > 0 ? sorted.length : null) : i; }, [sorted]);

  /* ---- strips 3 and 4: from the command center ---- */
  const mv: CcStep[] = useMemo(() => (cc.data?.movement.steps ?? []).filter((x) => x.direction !== "internal").sort((a, b) => a.seq - b.seq), [cc.data]);
  const mFrames: Frame[] = mv.map((m) => ({
    id: `${m.seq}-${m.step_type}`, title: m.title ?? m.step_type, sub: m.direction === "incoming" ? `↙ ${t("reel.mv.in")}` : `↗ ${t("reel.mv.out")}`,
    tone: m.draft?.sent_at ? "done" : m.state === "draft" ? "warn" : m.state === "incoming" ? "future" : "dim",
  }));
  const docs = cc.data?.documents;
  const preparedCodes = new Set((docs?.prepared ?? []).map((p) => String(p.code ?? p.doc_type ?? "")));
  const dFrames: Frame[] = [
    ...(docs?.types ?? []).map((d): Frame => ({ id: `t-${d.code}`, title: lang === "ar" ? d.name_ar : d.name_en, sub: d.code, tone: preparedCodes.has(d.code) ? "done" : d.has_template ? "future" : "dim" })),
    ...(docs?.prepared ?? []).filter((p) => !(docs?.types ?? []).some((d) => d.code === String(p.code ?? p.doc_type ?? ""))).map((p, i): Frame => ({ id: `p-${String(p.id ?? i)}`, title: String(p.file_name ?? p.name ?? p.code ?? "—"), tone: "done" })),
  ];

  const ccNote = cc.s === "load" || cc.s === "idle" ? t("reel.loading") : cc.s === "err" ? t("fl.err.generic") : undefined;
  const pick = (lane: Lane) => (id: string) => setSel((v) => (v && v.lane === lane && v.id === id ? null : { lane, id }));
  const close = () => setSel(null);
  const link = (view: string) => `/flights?id=${rotationId}&view=${view}#${view}`;

  /* ---- the glass card for the picked frame ---- */
  let card: React.ReactNode = null;
  if (sel?.lane === "flight") {
    const x = flight.find((i) => i.id === sel.id);
    if (x) card = (<>
      <h3><bdi>{x.title}</bdi><span className={`otps-chip ${x.done ? "done" : "in_window"}`}>{x.done ? t("reel.done") : t("reel.next")}</span></h3>
      {x.at && <p className="otps-lines"><b>{t("reel.when")}:</b> <span className="ltr">{fmtUtc(x.at)}</span></p>}
      {x.detail && <p className="otps-lines"><bdi>{x.detail}</bdi></p>}
      {x.href && <div className="otr-act"><Link className="otps-ghost" href={x.href}>{t("reel.open")}</Link></div>}
    </>);
  } else if (sel?.lane === "handling") {
    const s = sorted.find((i) => `${i.track}-${i.code}` === sel.id);
    if (s) card = (<>
      <h3><bdi>{stepName(s, lang)}</bdi>{s.isCritical && <span className="otps-chip overdue_unconfirmed">★ {t("fl.f.critical")}</span>}<span className={`otps-chip ${s.state === "recorded" ? "done" : s.state === "open" ? "in_window" : ""}`}>{s.state === "recorded" ? t("reel.done") : s.state === "open" ? t("reel.st.running") : t("reel.st.notRec")}</span></h3>
      <p className="otps-lines">
        <span>{t("reel.st.track")}: <bdi>{labelOf(lang, "track", s.track)}</bdi></span>
        <span className="ltr"> · {s.code}</span>
      </p>
      <p className="otps-lines">
        {s.plannedAt && <span className="ltr">{t("fl.tl.planned")} {hm(s.plannedAt)}</span>}
        {s.actualAt && <span className="ltr"> · {t("fl.tl.actual")} {fmtUtc(s.actualAt)}</span>}
        {s.variance !== null && s.state === "recorded" && <span className="ltr"> · {s.variance > 0 ? "+" : ""}{t("fl.min", { n: s.variance })}</span>}
      </p>
      {s.by && <p className="otps-lines">{t("reel.st.by")}: <bdi>{s.by}</bdi>{s.wasCorrected ? ` · ${t("reel.st.fixed")}` : ""}</p>}
      <div className="otr-act"><Link className="otps-ghost" href={link("handling")}>{t("reel.st.openSteps")}</Link></div>
    </>);
  } else if (sel?.lane === "movement") {
    const m = mv.find((i) => `${i.seq}-${i.step_type}` === sel.id);
    if (m) {
      const fields = [...(m.required ?? []), ...(m.required_unless ?? [])];
      const stateTag = m.draft?.sent_at ? ["done", t("reel.mv.sent")] : m.state === "draft" ? ["overdue_unconfirmed", t("reel.mv.draft")] : m.state === "incoming" ? ["in_window", t("reel.mv.wait")] : ["", t("reel.mv.none")];
      card = (<>
        <h3><bdi>{m.title ?? m.step_type}</bdi><span className="otps-chip">{m.direction === "incoming" ? t("reel.mv.in") : t("reel.mv.out")}</span><span className={`otps-chip ${stateTag[0]}`}>{stateTag[1]}</span></h3>
        {m.trigger_ar && <p className="otps-lines"><b>{t("reel.mv.trigger")}:</b> <bdi>{m.trigger_ar}</bdi></p>}
        {m.note_ar && <p className="otps-lines"><bdi>{m.note_ar}</bdi></p>}
        {fields.length > 0 && <><p className="otps-lines"><b>{t("reel.mv.fields")}:</b></p><div className="otr-chips">{fields.map((f) => <span key={f.field} className="otr-chip"><bdi>{f.label}</bdi></span>)}</div></>}
        {m.draft?.body_text && <><p className="otps-lines"><b>{t("reel.mv.body")}:</b></p><pre className="otr-pre">{m.draft.body_text}</pre>
          <div className="otr-act"><button type="button" className="otps-ghost" onClick={async () => { await navigator.clipboard.writeText(m.draft?.body_text ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t("copy.done") : t("fl.act.copy")}</button></div></>}
        <div className="otr-act"><Link className="otps-big" href={link("movement")}>{t("reel.mv.editor")}</Link></div>
      </>);
    }
  } else if (sel?.lane === "docs") {
    const d = (docs?.types ?? []).find((i) => `t-${i.code}` === sel.id);
    const p = (docs?.prepared ?? []).find((i, k) => `p-${String(i.id ?? k)}` === sel.id);
    if (d) card = (<>
      <h3><bdi>{lang === "ar" ? d.name_ar : d.name_en}</bdi><span className={`otps-chip ${preparedCodes.has(d.code) ? "done" : d.has_template ? "in_window" : ""}`}>{preparedCodes.has(d.code) ? t("reel.doc.prepared") : d.has_template ? t("fl.doc.hasTemplate") : t("fl.doc.none")}</span></h3>
      <p className="otps-lines ltr">{d.code}{d.scope ? ` · ${d.scope}` : ""}</p>
      <p className="otps-lines"><bdi>{d.has_template ? d.template_name ?? "" : t("fl.doc.noTemplate")}</bdi></p>
      <div className="otr-act"><button type="button" className="otps-big" disabled title={t("fl.doc.notBuilt")}>{t("fl.doc.make")}</button></div>
      <p className="otps-lines otr-muted">{t("fl.doc.notBuilt")}</p>
    </>);
    else if (p) card = (<>
      <h3><bdi>{String(p.file_name ?? p.name ?? p.code ?? "—")}</bdi><span className="otps-chip done">{t("reel.doc.prepared")}</span></h3>
      <div className="otr-act"><Link className="otps-ghost" href={link("docs")}>{t("reel.open")}</Link></div>
    </>);
  }

  return (
    <section className="otr" ref={host} aria-label={t("reel.aria")}>
      <header className="otr-head"><b>{t("reel.title")}</b></header>
      <Strip label={t("reel.l.flight")} count={flight.length} frames={fFrames} nowAt={fNow} sel={sel?.lane === "flight" ? sel.id : null} onPick={pick("flight")} />
      <Strip label={t("reel.l.handling")} count={sorted.length} frames={sFrames} nowAt={sNow} sel={sel?.lane === "handling" ? sel.id : null} onPick={pick("handling")} />
      <Strip label={t("reel.l.movement")} count={mv.length} frames={mFrames} nowAt={null} sel={sel?.lane === "movement" ? sel.id : null} onPick={pick("movement")} note={ccNote} />
      <Strip label={t("reel.l.docs")} count={dFrames.length} frames={dFrames} nowAt={null} sel={sel?.lane === "docs" ? sel.id : null} onPick={pick("docs")} note={ccNote} />
      {card && (
        <div className="otps-sheet otr-card" role="dialog" aria-live="polite">
          <div className="grab" aria-hidden="true" />
          <button type="button" className="x" onClick={close} aria-label={t("ots.close")}>×</button>
          {card}
        </div>
      )}
    </section>
  );
}
