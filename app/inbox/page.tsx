import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import Hint from "@/components/Hint";
import DraftPanel from "@/components/DraftPanel";
import OpenRequestForm from "@/components/OpenRequestForm";
import CopyButton from "@/components/CopyButton";
import ScrollTop from "@/components/ScrollTop";
import { getFilesForMessage, resolveAirlines } from "@/lib/requests";
import { getCommandData } from "@/lib/data";
import { getInbox, type InboxItem } from "@/lib/inbox";
import { getT } from "@/lib/lang";
import { labelOf, fwd, type Key } from "@/lib/i18n";

const tone = (u: string) => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(5, 10) : "");
const full = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ id?: string; q?: string; f?: string }> }) {
  const { t, lang } = await getT();
  const [d, all, sp] = await Promise.all([getCommandData(), getInbox(), searchParams]);
  const L = (prefix: string, v: string) => labelOf(lang, prefix, v);
  const title = (i: InboxItem) => i.message?.subject ?? L("cat", i.category);
  const nextArrow = fwd(lang); const prevArrow = lang === "ar" ? "›" : "‹";
  const needle = (sp.q ?? "").trim().toLowerCase();
  const items = all.filter((i) => (sp.f !== "new" || i.status === "new") && (!needle || [i.message?.subject, i.summary, i.flightNumber, i.message?.from].some((x) => (x ?? "").toLowerCase().includes(needle))));
  const selId = sp.id ?? (items.find((i) => i.status === "new") ?? items[0])?.id;
  const sel = all.find((i) => i.id === selId) ?? null;
  const idx = sel ? items.findIndex((i) => i.id === sel.id) : -1;
  const q = (id: string) => { const p = new URLSearchParams({ id }); if (needle) p.set("q", sp.q ?? ""); if (sp.f === "new") p.set("f", "new"); return `/inbox?${p}`; };
  const listHref = (f?: string) => { const p = new URLSearchParams(); if (needle) p.set("q", sp.q ?? ""); if (f) p.set("f", f); const s = p.toString(); return `/inbox${s ? `?${s}` : ""}`; };
  const [files, airlines] = sel ? await Promise.all([getFilesForMessage(sel.messageId), resolveAirlines([sel.flightNumber])]) : [{ linked: [], linkable: [] }, new Map()];
  const airline = sel?.flightNumber ? [...airlines.values()][0] ?? null : null;
  const newCount = all.filter((i) => i.status === "new").length;

  // one primary action, taken from what SKYEYE actually prepared; never a recorded time
  const primary = !sel ? null
    : sel.draft?.status === "draft" ? { label: t("data.email.reviewDraft"), href: "#draft" }
    : sel.flightRotationId && sel.category === "mvt" ? { label: t("inbox.act.recordActual"), href: `/flights?id=${sel.flightRotationId}&view=timeline` }
    : sel.flightRotationId ? { label: t("inbox.act.openFile"), href: `/flights?id=${sel.flightRotationId}` } : null;

  return (
    <Shell data={d}>
      <main className="page">
        <section className="fhero" aria-label={t("nav.inbox")}><h1>{t("nav.inbox")}</h1><p>{t("inbox.sub")}{newCount ? t("inbox.newCount", { n: newCount }) : ""}.</p></section>
        <div className={`imail ${sp.id ? "reading" : ""}`}>
          <section className="ilist card" aria-label={t("inbox.list.aria")}>
            <form method="get" action="/inbox" role="search" className="isearch">
              {sp.f === "new" && <input type="hidden" name="f" value="new" />}
              <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder={t("inbox.search.ph")} aria-label={t("inbox.search.aria")} />
            </form>
            <div className="ffilters"><Link className={`chip-link ${sp.f !== "new" ? "on" : ""}`} href={listHref()}>{t("inbox.f.all")}</Link><Link className={`chip-link ${sp.f === "new" ? "on" : ""}`} href={listHref("new")}>{t("est.new")}</Link></div>
            {items.length === 0 && <p className="muted">{all.length === 0 ? t("inbox.empty") : t("inbox.noMatch")}</p>}
            <ul className="mlist">
              {items.map((i) => (
                <li key={i.id} className={`mrow ${i.id === sel?.id ? "cur" : ""}`}>
                  <Link href={q(i.id)} aria-current={i.id === sel?.id ? "true" : undefined}>
                    <span className="mtime ltr"><b>{hm(i.message?.at ?? i.createdAt)}</b><small>{day(i.message?.at ?? i.createdAt)}</small></span>
                    <span className="mbody"><b className="mtitle"><bdi>{title(i)}</bdi></b><small className="muted"><bdi>{i.summary ?? ""}</bdi></small>
                      <small className="muted">{i.flightNumber && <span className="ltr">{i.flightNumber} · </span>}{L("cat", i.category)}{i.message?.hasAttachments ? " · 📎" : ""}</small></span>
                    <span className="mflags">{i.status === "new" && <i className={`dot ${tone(i.urgency)}`} aria-label={t("est.new")} />}{i.draft?.status === "draft" && <em className="tag warn">{t("inbox.draftTag")}</em>}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <small className="muted">{t("inbox.count", { n: items.length, total: all.length })}</small>
          </section>

          <section className="ireader" aria-label={t("inbox.reader.aria")}>
            {!sel && <div className="card"><p className="muted">{t("inbox.pick")}</p></div>}
            {sel && <>
              <ScrollTop id={sel.id} />
              <div className="itool">
                <Link className="back ireturn" href={listHref(sp.f)}>{t("inbox.back")}</Link>
                <span className="grow" />
                {idx > 0 && <Link className="btn ghost sm" href={q(items[idx - 1].id)} aria-label={t("inbox.prev")}>{prevArrow}</Link>}
                {idx >= 0 && idx < items.length - 1 && <Link className="btn ghost sm" href={q(items[idx + 1].id)} aria-label={t("inbox.next")}>{nextArrow}</Link>}
                <CopyButton text={sel.message?.body ?? ""} label={t("inbox.copyBody")} />
                {sel.draft && <Link className="btn sm" href="#draft">{t("inbox.reply")}</Link>}
                {sel.flightRotationId ? <Link className="btn gold sm" href={`/flights?id=${sel.flightRotationId}`}>{t("cockpit.open")}</Link> : <span className="tag info">{t("inbox.noFlight")}</span>}
              </div>

              <div className="card">
                <div className="mhead">
                  {airline && <Logo url={airline.logoUrl} code={airline.code} name={airline.name} size="md" />}
                  <div><h2><bdi>{title(sel)}</bdi></h2>
                    <div className="chips"><span className={`tag ${tone(sel.urgency)}`}>{L("urg", sel.urgency)}</span><span className="tag info">{L("cat", sel.category)}</span><span className={`tag ${sel.status === "new" ? "warn" : "ok"}`}>{L("est", sel.status)}</span></div></div>
                </div>
                <dl className="meta ltr"><div><dt>From</dt><dd>{sel.message?.from}</dd></div><div><dt>To</dt><dd>{sel.message?.to.join(", ")}</dd></div>{sel.message?.cc.length ? <div><dt>Cc</dt><dd>{sel.message.cc.join(", ")}</dd></div> : null}<div><dt>Date</dt><dd>{full(sel.message?.at ?? sel.createdAt)}</dd></div></dl>
                <pre className="ltr orig">{sel.message?.body}</pre>
              </div>

              <div className="card understand">
                <h2>{t("inbox.summary")}<Hint>{t("inbox.summary.hint")}</Hint></h2>
                <p>{sel.summary ?? t("inbox.noSummary")}</p>
                <dl>
                  <div><dt>{t("inbox.wants")}</dt><dd>{sel.requestedAction ?? t("inbox.noAsk")}</dd></div>
                  <div><dt>{t("inbox.reply.q")}</dt><dd>{sel.replyKind === "acknowledge" ? t("inbox.reply.ack") : t("inbox.reply.sub")} {sel.replyReason}</dd></div>
                  <div><dt>{t("inbox.flight")}</dt><dd className="ltr">{sel.flightLabel ?? t("inbox.notLinked")}</dd></div>
                  <div><dt>{t("inbox.attachments")}</dt><dd>{sel.attachments.length === 0 ? (sel.message?.hasAttachments ? t("inbox.attach.unrecorded") : t("inbox.attach.none")) : sel.attachments.map((a) => <div key={a.name}><bdi className="ltr">{a.name}</bdi> — {L("att", a.state)}</div>)}</dd></div>
                </dl>
              </div>

              <div className="card actions-card">
                <h2>{t("inbox.actions")}</h2>
                <div className="row">
                  {primary ? <Link className="btn gold" href={primary.href}>{primary.label}</Link> : <p className="muted">{t("inbox.noAction")}</p>}
                  {sel.flightRotationId && primary?.href !== `/flights?id=${sel.flightRotationId}` && <Link className="btn" href={`/flights?id=${sel.flightRotationId}`}>{t("inbox.followTimeline")}</Link>}
                </div>
                <details><summary>{t("inbox.files")}</summary><OpenRequestForm key={sel.id} companyId={d.company.id} triageId={sel.id} messageId={sel.messageId} linked={files.linked} linkable={files.linkable} suggestComplaint={sel.category === "complaint"} /></details>
              </div>

              <div className="card" id="draft"><h2>{t("inbox.draft.title")}</h2>
                {sel.draft ? <DraftPanel key={sel.draft.id} draft={sel.draft} /> : <p className="muted">{t("inbox.draft.none")}</p>}
              </div>
            </>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
