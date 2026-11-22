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
import "./command.css";
import "./command-map.css";
import CommandMap from "@/components/CommandMap";
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
  const { t, lang } = await getT();
  const ar = lang === "ar";
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

  const lane = (x: Decision) => {
    const body = <><span className="cr-tag"><i className={x.tone} aria-hidden="true" /></span><span className="cr-lane-track" aria-hidden="true"><span className={`cr-zone ${x.tone}`} /><svg className={`cr-lane-plane ${x.tone}`} viewBox="-12 -14 52 28" width="46" height="24"><path d="M-9 0c0-1 1-2 3-2.4l22-1.2c3-.2 6 1.2 7.4 3.6-1.4 2.4-4.4 3.8-7.4 3.6l-22-1.2c-2-.4-3-1.4-3-2.4zM3 -1.4L-4 -12h4l9 10.6zM3 1.4L-4 12h4l9-10.6z" fill="currentColor" /></svg></span><span className="cr-lane-text"><bdi>{short(x.text)}</bdi><small>{t(`tone.${x.tone}` as Key)}</small></span></>;
    return <li key={x.id}>{x.href ? <Link className="cr-lane" href={x.href}>{body}</Link> : <span className="cr-lane">{body}</span>}</li>;
  };

  return (
    <Shell data={d}>
      <main className="page hm">
        <section className="cr" aria-label={t("nav.home")} dir={ar ? "rtl" : "ltr"}>
          <header className="cr-top">
            <h1><span className="cr-title-ico" aria-hidden="true">✈</span>{t("nav.home")}</h1>
            <span className="cr-date ltr">{g.date}</span>
            {d.shadowMode && <span className="cr-badge shadow">{ar ? "تجريبي · لا يرسل شيئًا" : "Shadow · sends nothing"}</span>}
          </header>

          <div className="cr-panel cr-scope-panel cr-hero">
            <h2 className="cr-h">{ar ? "شاشة البرج" : "Tower scope"}<span className="cr-live">{ar ? "مباشر" : "LIVE"}</span></h2>
            <div className="tc tc-strip" aria-live="polite">
              <p className="tc-k"><span className="tc-wave" aria-hidden="true"><i /><i /><i /><i /></span>{ar ? "نداء البرج" : "Tower call"}</p>
              <p className="tc-hi">{t("home.title", { greet: t(g.key) })}</p>
              {d.noMembership
                ? <p className="tc-l">{t("home.noMembership")}</p>
                : sentences.length === 0 ? <p className="tc-l calm">{t("home.reco.none")}</p>
                : <ul className="tc-ls">{sentences.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            </div>
            <CommandMap counts={c.radar} flights={c.radarFlights} lang={ar ? "ar" : "en"} labels={{ onGround: t("radar.onGround"), inbound: t("radar.inbound"), delayed: t("radar.delayed"), awaitingMsg: t("radar.awaitingMsg") }} />
          </div>

          {first && (
            <div id="attention" className={`cr-next ${first.tone}`} aria-label={t("home.next.title")}>
              <span className="cr-next-plane" aria-hidden="true"><svg viewBox="-12 -14 52 28" width="64" height="34"><path d="M-9 0c0-1 1-2 3-2.4l22-1.2c3-.2 6 1.2 7.4 3.6-1.4 2.4-4.4 3.8-7.4 3.6l-22-1.2c-2-.4-3-1.4-3-2.4zM3 -1.4L-4 -12h4l9 10.6zM3 1.4L-4 12h4l9-10.6z" fill="currentColor" /></svg></span>
              <div className="cr-next-text"><h2>{t("home.next.title")}</h2><p><bdi>{first.text}</bdi></p></div>
              {first.href && <Link className="cr-go" href={first.href}>{first.action}</Link>}
            </div>
          )}

          {rest.length > 0 && (
            <div className="cr-panel cr-queue" aria-label={t("home.then")}>
              <h2 className="cr-h">{ar ? "طابور المدرج" : "Runway queue"}<small className="cr-hint">{t("home.then")}</small></h2>
              <ul className="cr-lanes">{rest.slice(0, SHOW).map(lane)}</ul>
              {rest.length > SHOW && (
                <details className="cr-more">
                  <summary>{t("home.more", { n: rest.length - SHOW })}</summary>
                  <ul className="cr-lanes">{rest.slice(SHOW).map(lane)}</ul>
                </details>)}
            </div>
          )}
        </section>

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
