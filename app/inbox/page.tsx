import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import Hint from "@/components/Hint";
import DraftPanel from "@/components/DraftPanel";
import OpenRequestForm from "@/components/OpenRequestForm";
import CopyButton from "@/components/CopyButton";
import ScrollTop from "@/components/ScrollTop";
import MailIcon from "@/components/MailIcon";
import { getFilesForMessage, resolveAirlines } from "@/lib/requests";
import { getCommandData } from "@/lib/data";
import { getInbox, type InboxItem } from "@/lib/inbox";
import { getT } from "@/lib/lang";
import { labelOf, fwd, type Key } from "@/lib/i18n";

const tone = (u: string) => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(5, 10) : "");
const full = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—");

/** Email bodies often arrive padded with NBSP, trailing spaces and runs of blank lines. Show them tidy; the stored message is untouched. */
const cleanBody = (b: string | null | undefined) =>
  (b ?? "").replace(/\r\n?/g, "\n").replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, " ").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ id?: string; q?: string; f?: string; fl?: string }> }) {
  const { t, lang } = await getT();
  const [d, all, sp] = await Promise.all([getCommandData(), getInbox(), searchParams]);
  const L = (prefix: string, v: string) => labelOf(lang, prefix, v);
  const title = (i: InboxItem) => i.message?.subject ?? L("cat", i.category);
  const nextArrow = fwd(lang); const prevArrow = lang === "ar" ? "›" : "‹";
  const needle = (sp.q ?? "").trim().toLowerCase();
  const flightFilter = (sp.fl ?? "").trim();
  const flightOptions = [...new Set(all.map((i) => i.flightNumber).filter(Boolean))].sort() as string[];
  const items = all.filter((i) => (sp.f !== "new" || i.status === "new") && (sp.f !== "draft" || i.draft?.status === "draft") && (!flightFilter || i.flightNumber === flightFilter) && (!needle || [i.message?.subject, i.summary, i.flightNumber, i.message?.from].some((x) => (x ?? "").toLowerCase().includes(needle))));
  const selId = sp.id ?? (items.find((i) => i.status === "new") ?? items[0])?.id;
  const sel = all.find((i) => i.id === selId) ?? null;
  const idx = sel ? items.findIndex((i) => i.id === sel.id) : -1;
  const q = (id: string) => { const p = new URLSearchParams({ id }); if (needle) p.set("q", sp.q ?? ""); if (sp.f) p.set("f", sp.f); if (flightFilter) p.set("fl", flightFilter); return `/inbox?${p}`; };
  const listHref = (f?: string) => { const p = new URLSearchParams(); if (needle) p.set("q", sp.q ?? ""); if (f) p.set("f", f); if (flightFilter) p.set("fl", flightFilter); const s = p.toString(); return `/inbox${s ? `?${s}` : ""}`; };
  const [files, airlines] = sel ? await Promise.all([getFilesForMessage(sel.messageId), resolveAirlines([sel.flightNumber])]) : [{ linked: [], linkable: [] }, new Map()];
  const airline = sel?.flightNumber ? [...airlines.values()][0] ?? null : null;
  const newCount = all.filter((i) => i.status === "new").length;
  const draftCount = all.filter((i) => i.draft?.status === "draft").length;
  const today = new Date().toISOString().slice(0, 10);
  const whenOf = (iso: string | null) => (iso && iso.slice(0, 10) === today ? `${t("inbox.today")} ${hm(iso)}` : full(iso));
  const fwdHref = sel ? `mailto:?subject=${encodeURIComponent("Fwd: " + title(sel))}&body=${encodeURIComponent(sel.message?.body ?? "")}` : "#";

  // one primary action, taken from what SKYEYE actually prepared; never a recorded time
  const primary = !sel ? null
    : sel.draft?.status === "draft" ? { label: t("data.email.reviewDraft"), href: "#draft" }
    : sel.flightRotationId && sel.category === "mvt" ? { label: t("inbox.act.recordActual"), href: `/flights?id=${sel.flightRotationId}&view=timeline` }
    : sel.flightRotationId ? { label: t("inbox.act.openFile"), href: `/flights?id=${sel.flightRotationId}` } : null;

  return (
    <Shell data={d}>
      <main className="page">
        <section className="fhero" aria-label={t("nav.inbox")}><h1>{t("nav.inbox")}</h1><p>{t("inbox.sub")}{newCount ? t("inbox.newCount", { n: newCount }) : ""}.</p></section>
        <div className={`imail ix ${sp.id ? "reading" : ""}`}>
          <section className="ilist ix-list" aria-label={t("inbox.list.aria")}>
            <form method="get" action="/inbox" role="search" className="ix-search">
              {sp.f && <input type="hidden" name="f" value={sp.f} />}
              <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder={t("inbox.search.ph")} aria-label={t("inbox.search.aria")} />
              <select name="fl" defaultValue={flightFilter} aria-label={t("inbox.f.flight.aria")} className="ix-select">
                <option value="">{t("inbox.f.allFlights")}</option>
                {flightOptions.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <button type="submit" className="ix-go" aria-label={t("inbox.search.aria")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg></button>
            </form>
            <div className="ffilters ix-tabs"><Link className={`chip-link ${!sp.f ? "on" : ""}`} href={listHref()}>{t("inbox.f.all")}</Link><Link className={`chip-link ${sp.f === "new" ? "on" : ""}`} href={listHref("new")}>{t("est.new")}{newCount ? ` · ${newCount}` : ""}</Link><Link className={`chip-link ${sp.f === "draft" ? "on" : ""}`} href={listHref("draft")}>{t("inbox.f.drafts")}{draftCount ? ` · ${draftCount}` : ""}</Link></div>
            {items.length === 0 && <p className="muted">{all.length === 0 ? t("inbox.empty") : t("inbox.noMatch")}</p>}
            <ul className="ix-rows">
              {items.map((i) => (
                <li key={i.id} className={`ix-row ${i.id === sel?.id ? "cur" : ""} ${i.status === "new" ? "unread" : ""}`}>
                  <Link href={q(i.id)} aria-current={i.id === sel?.id ? "true" : undefined}>
                    <span className="ix-ico" aria-hidden="true"><MailIcon category={i.category} /></span>
                    <span className="ix-main">
                      <span className="ix-top"><b className="ix-title"><bdi>{title(i)}</bdi></b><span className="ix-time ltr">{hm(i.message?.at ?? i.createdAt)}{i.message?.hasAttachments ? " 📎" : ""}</span></span>
                      <small className="ix-sum"><bdi>{i.summary ?? ""}</bdi></small>
                      <small className="ix-meta">{i.flightNumber && <span className="ltr ix-fn">{i.flightNumber}</span>}<span>{L("cat", i.category)}</span>{i.draft?.status === "draft" && <em className="tag warn">{t("inbox.draftTag")}</em>}</small>
                    </span>
                    {i.status === "new" && <i className={`dot ${tone(i.urgency)}`} aria-label={t("est.new")} />}
                  </Link>
                </li>
              ))}
            </ul>
            <small className="ix-count">{t("inbox.count", { n: items.length, total: all.length })}</small>
          </section>

          <section className="ireader ix-reader" aria-label={t("inbox.reader.aria")}>
            {!sel && <div className="ix-paper"><p className="muted">{t("inbox.pick")}</p></div>}
            {sel && <>
              <ScrollTop id={sel.id} />
              <div className="itool ix-tool">
                <Link className="back ireturn" href={listHref(sp.f)}>{t("inbox.back")}</Link>
                {sel.flightRotationId ? <Link className="ix-btn gold" href={`/flights?id=${sel.flightRotationId}`}>{t("cockpit.open")}</Link> : <span className="tag info">{t("inbox.noFlight")}</span>}
                <CopyButton text={sel.message?.body ?? ""} label={t("inbox.copyBody")} />
                <a className="ix-btn" href={fwdHref}>{t("inbox.forward")}</a>
                {sel.draft && <Link className="ix-btn" href="#draft">{t("inbox.reply")}</Link>}
                <span className="grow" />
                {idx > 0 && <Link className="ix-btn icon" href={q(items[idx - 1].id)} aria-label={t("inbox.prev")}>{prevArrow}</Link>}
                {idx >= 0 && idx < items.length - 1 && <Link className="ix-btn icon" href={q(items[idx + 1].id)} aria-label={t("inbox.next")}>{nextArrow}</Link>}
              </div>

              <article className="ix-paper">
                <header className="mhead ix-head">
                  {airline && <Logo url={airline.logoUrl} code={airline.code} name={airline.name} size="md" />}
                  <div className="ix-headtext"><h2><bdi>{title(sel)}</bdi></h2>
                    <div className="chips"><span className={`tag ${tone(sel.urgency)}`}>{L("urg", sel.urgency)}</span><span className="tag info">{L("cat", sel.category)}</span><span className={`tag ${sel.status === "new" ? "warn" : "ok"}`}>{L("est", sel.status)}</span></div>
                    <dl className="meta ltr"><div><dt>From</dt><dd>{sel.message?.from}</dd></div><div><dt>To</dt><dd>{sel.message?.to.join(", ")}</dd></div>{sel.message?.cc.length ? <div><dt>Cc</dt><dd>{sel.message.cc.join(", ")}</dd></div> : null}<div><dt>Date</dt><dd>{whenOf(sel.message?.at ?? sel.createdAt)}</dd></div></dl>
                  </div>
                </header>
                <pre className="ltr orig ix-body">{cleanBody(sel.message?.body)}</pre>

                <section className="ix-agent" aria-label={t("inbox.summary")}>
                  <h3>{t("inbox.summary")}<Hint>{t("inbox.summary.hint")}</Hint></h3>
                  <p>{sel.summary ?? t("inbox.noSummary")}</p>
                  <dl>
                    <div><dt>{t("inbox.wants")}</dt><dd>{sel.requestedAction ?? t("inbox.noAsk")}</dd></div>
                    <div><dt>{t("inbox.reply.q")}</dt><dd>{sel.replyKind === "acknowledge" ? t("inbox.reply.ack") : t("inbox.reply.sub")} {sel.replyReason}</dd></div>
                    <div><dt>{t("inbox.flight")}</dt><dd className="ltr">{sel.flightLabel ?? t("inbox.notLinked")}</dd></div>
                    <div><dt>{t("inbox.attachments")}</dt><dd>{sel.attachments.length === 0 ? (sel.message?.hasAttachments ? t("inbox.attach.unrecorded") : t("inbox.attach.none")) : sel.attachments.map((a) => <div key={a.name}><bdi className="ltr">{a.name}</bdi> — {L("att", a.state)}</div>)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="ix-actions" aria-label={t("inbox.actions")}>
                  <h3>{t("inbox.actions")}</h3>
                  <div className="row">
                    {primary ? <Link className="ix-btn gold wide" href={primary.href}>{primary.label}</Link> : <p className="muted">{t("inbox.noAction")}</p>}
                    {sel.flightRotationId && primary?.href !== `/flights?id=${sel.flightRotationId}` && <Link className="ix-btn wide" href={`/flights?id=${sel.flightRotationId}`}>{t("inbox.followTimeline")}</Link>}
                  </div>
                  <details><summary>{t("inbox.files")}</summary><OpenRequestForm key={sel.id} companyId={d.company.id} triageId={sel.id} messageId={sel.messageId} linked={files.linked} linkable={files.linkable} suggestComplaint={sel.category === "complaint"} /></details>
                </section>
              </article>

              <section className="ix-paper ix-draftcard" id="draft"><h2>{t("inbox.draft.title")}</h2>
                {sel.draft ? <DraftPanel key={sel.draft.id} draft={sel.draft} /> : <p className="muted">{t("inbox.draft.none")}</p>}
              </section>
            </>}
          </section>
        </div>
      </main>
    </Shell>
  );
}
