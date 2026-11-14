import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { inCompanyView } from "@/lib/mode";
import Shell from "@/components/Shell";
import ToneIcon from "@/components/ToneIcon";
import LibraryPanel from "@/components/LibraryPanel";
import { getLibrary, isLibKind } from "@/lib/library";
import "./home.css";
import { getCommandData, type Decision } from "@/lib/data";
import { getCockpit } from "@/lib/cockpit";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

const RANK: Record<string, number> = { late: 0, warn: 1, info: 2, ok: 3 };
const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

function greeting(now: Date) {
  const h = +new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(now) % 24;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "short" }).format(now);
  const key: Key = h >= 5 && h < 12 ? "home.greet.morning" : h >= 12 ? "home.greet.evening" : "home.greet.night";
  return { key, date };
}

/** Fills {name} placeholders of a translated sentence with links, so the numbers live inside the sentence. */
const fill = (tpl: string, m: Record<string, ReactNode>) =>
  tpl.split(/(\{\w+\})/).map((p, i) => { const k = /^\{(\w+)\}$/.exec(p)?.[1]; return k && k in m ? <span key={i}>{m[k]}</span> : p; });

type SP = { q?: string | string[]; k?: string | string[]; f?: string | string[]; fk?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CommandPage({ searchParams }: { searchParams: Promise<SP> }) {
  if ((await isPlatformAdmin()) && !(await inCompanyView())) redirect("/admin");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80); const k = one(sp.k); const fk = one(sp.fk); const f = one(sp.f).trim().slice(0, 80);
  const kind = isLibKind(k) ? k : null;
  const open = f && isLibKind(fk) ? { no: f, kind: fk } : null;
  const searching = Boolean(q || kind || open);
  const [d, c, lib] = await Promise.all([getCommandData(), getCockpit(), searching ? getLibrary(q, kind, open) : Promise.resolve(null)]);
  const { t } = await getT();
  const g = greeting(new Date());

  // One entry per situation: the same overdue flight can reach us from the flight rules and from the alerts.
  const seen = new Set<string>();
  const stream: Decision[] = [...c.flightDecisions, ...d.decisions]
    .sort((a, b) => RANK[a.tone] - RANK[b.tone])
    .filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
  const first = stream[0];
  const rest = stream.slice(1);
  const SHOW = 4;

  const num = (n: number, href: string, hot?: boolean) => <Link href={href} className={`hm-n ltr${hot ? " hot" : ""}`}>{n}</Link>;
  const sentences: ReactNode[] = [];
  if (!d.noMembership) {
    if ((c.todayFlights ?? 0) > 0 || (c.onGround ?? 0) > 0) sentences.push(fill(t("home.s.flights"), { today: num(c.todayFlights ?? 0, "/flights?day=today"), ground: num(c.onGround ?? 0, "/flights") }));
    if ((c.delayed ?? 0) > 0) sentences.push(fill(t("home.s.late"), { n: num(c.delayed ?? 0, "/flights", true) }));
    if ((d.counts.inboxToReview ?? 0) > 0) sentences.push(fill(t("home.s.mail"), { n: num(d.counts.inboxToReview ?? 0, "/inbox?f=new") }));
    if ((d.counts.draftsWaiting ?? 0) > 0) sentences.push(fill(t("home.s.drafts"), { n: num(d.counts.draftsWaiting ?? 0, "/inbox?f=draft") }));
  }

  const pill = (x: Decision) => {
    const body = <><i className={`dot ${x.tone}`} aria-hidden="true" /><span><bdi>{short(x.text)}</bdi></span><small>{t(`tone.${x.tone}` as Key)}</small></>;
    return <li key={x.id}>{x.href ? <Link className={`hm-pill ${x.tone}`} href={x.href}>{body}</Link> : <span className={`hm-pill ${x.tone}`}>{body}</span>}</li>;
  };

  return (
    <Shell data={d}>
      <main className="page hm">
        <section className="hm-hero" aria-label={t("nav.home")}>
          <p className="hm-eyebrow"><span className="ltr">{g.date}</span></p>
          <h1>{t("home.title", { greet: t(g.key) })}</h1>
          {d.noMembership
            ? <p className="hm-story">{t("home.noMembership")}</p>
            : <p className="hm-story" aria-live="polite">{sentences.length === 0 ? t("home.reco.none") : sentences.map((s, i) => <span key={i} className="hm-sent">{s} </span>)}</p>}
        </section>

        {first && (
          <section id="attention" className={`hm-next ${first.tone}`} aria-label={t("home.next.title")}>
            <span className="hm-next-ico" aria-hidden="true"><ToneIcon name={first.tone} size={26} /></span>
            <div className="hm-next-text"><h2>{t("home.next.title")}</h2><p><bdi>{first.text}</bdi></p></div>
            {first.href && <Link className="hm-go" href={first.href}>{first.action}</Link>}
          </section>
        )}

        {rest.length > 0 && (
          <section className="hm-then" aria-label={t("home.then")}>
            <h2>{t("home.then")}</h2>
            <ul className="hm-pills">{rest.slice(0, SHOW).map(pill)}</ul>
            {rest.length > SHOW && (
              <details className="hm-more">
                <summary>{t("home.more", { n: rest.length - SHOW })}</summary>
                <ul className="hm-pills">{rest.slice(SHOW).map(pill)}</ul>
              </details>)}
          </section>
        )}

        {!d.noMembership && (
          <form action="/agent" method="get" className="hm-say" role="search" aria-label={t("home.say.aria")}>
            <span className="hm-say-ico" aria-hidden="true"><ToneIcon name="agent" size={22} /></span>
            <input name="say" maxLength={500} autoComplete="off" placeholder={t("home.say.ph")} aria-label={t("home.say.aria")} />
            <button className="btn gold">{t("home.say.go")}</button>
          </form>
        )}

        {!d.noMembership && (
          <div className="hm-find">
            <form action="/" method="get" role="search" aria-label={t("home.find.aria")}>
              <input name="q" defaultValue={q} className="ltr" autoComplete="off" placeholder={t("home.find.ph")} aria-label={t("home.find.aria")} />
              <button className="btn">{t("home.find.go")}</button>
            </form>
            <Link href="/files" className="hm-docs">{t("lib.docs")} <small>{t("lib.docs.sub")}</small></Link>
          </div>
        )}

        {searching && <LibraryPanel data={lib} q={q} kind={kind} open={open} />}
      </main>
    </Shell>
  );
}
