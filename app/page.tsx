import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { inCompanyView } from "@/lib/mode";
import Shell from "@/components/Shell";
import Radar from "@/components/Radar";
import ToneIcon from "@/components/ToneIcon";
import LibraryPanel from "@/components/LibraryPanel";
import { getLibrary, isLibKind } from "@/lib/library";
import "./home.css";
import { getCommandData, type Decision } from "@/lib/data";
import { getCockpit } from "@/lib/cockpit";
import { getT } from "@/lib/lang";
import type { Key } from "@/lib/i18n";

const dash = (n: number | null) => (n ?? "—");
const RANK: Record<string, number> = { late: 0, warn: 1, info: 2, ok: 3 };
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

function greeting(now: Date) {
  const h = +new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(now) % 24;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "short" }).format(now);
  const key: Key = h >= 5 && h < 12 ? "home.greet.morning" : h >= 12 ? "home.greet.evening" : "home.greet.night";
  return { key, date };
}

type SP = { q?: string | string[]; k?: string | string[]; f?: string | string[]; fk?: string | string[] };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CommandPage({ searchParams }: { searchParams: Promise<SP> }) {
  if ((await isPlatformAdmin()) && !(await inCompanyView())) redirect("/admin");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80); const k = one(sp.k); const fk = one(sp.fk); const f = one(sp.f).trim().slice(0, 80);
  const kind = isLibKind(k) ? k : null;
  const open = f && isLibKind(fk) ? { no: f, kind: fk } : null;
  const [d, c, lib] = await Promise.all([getCommandData(), getCockpit(), getLibrary(q, kind, open)]);
  const { t } = await getT();
  const g = greeting(new Date());
  const stream: Decision[] = [...c.flightDecisions, ...d.decisions].sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  const attention = (d.counts.urgentAlerts ?? 0) + (c.delayed ?? 0);
  const first = stream[0];
  const reco = d.noMembership ? null
    : stream.length === 0 ? t("home.reco.none")
    : t(stream.length === 1 ? "home.reco.one" : "home.reco.many", { n: stream.length, first: short(first.text) });

  const stat = (n: number | null | undefined, label: string, href: string, hot?: boolean) => (
    <Link href={href} className="hm-stat"><b className={`ltr ${hot ? "hot" : ""}`}>{d.noMembership ? "—" : dash(n ?? null)}</b><small>{label}</small></Link>);

  const rest = stream.slice(1);
  const SHOW = 3;
  const row = (x: Decision, i: number) => (
    <li key={x.id} className={`hm-row ${x.tone}`}>
      <span className="hm-row-ico"><ToneIcon name={x.tone} /></span>
      <span className="hm-row-text"><b><bdi>{x.text}</bdi></b><small>{t(`tone.${x.tone}` as Key)}</small></span>
      {x.href ? <Link className="hm-act" href={x.href}>{x.action}</Link> : null}
    </li>);

  return (
    <Shell data={d}>
      <main className="page hm">
        <section className="hm-hero" aria-label={t("nav.home")}>
          <div className="hm-hero-top">
            <div className="hm-greet">
              <p className="hm-eyebrow"><span className="ltr">{g.date}</span></p>
              <h1>{t("home.title", { greet: t(g.key) })}</h1>
              <p>{t("home.subtitle")}</p>
            </div>
            <div className="hm-radar">
              <div className="hm-radar-ttl"><span className="livedot" aria-hidden="true" />{t("home.radar")}</div>
              <Radar counts={c.radar} />
            </div>
          </div>
          <div className="hm-stats" role="group" aria-label={t("home.stats.aria")}>
            {stat(c.todayFlights, t("home.stat.today"), "/flights?day=today")}
            {stat(c.onGround, t("home.stat.ground"), "/flights")}
            {stat(attention, t("home.stat.attention"), "#attention", attention > 0)}
            {stat(d.counts.inboxToReview, t("home.stat.emails"), "/inbox?f=new")}
          </div>
        </section>

        {d.noMembership && <p className="hm-empty">{t("home.noMembership")}</p>}

        {reco && (
          <section id="attention" className={`hm-next ${first?.tone ?? "ok"}`} aria-label={t("home.reco.title")}>
            <span className="hm-next-ico" aria-hidden="true"><ToneIcon name={first?.tone ?? "ok"} size={26} /></span>
            <div className="hm-next-text"><h2>{t("home.reco.title")}</h2><p>{reco}</p></div>
            {first?.href && <Link className="hm-go" href={first.href}>{first.action}</Link>}
          </section>
        )}

        {rest.length > 0 && (
          <section className="hm-list" aria-label={t("home.attention")}>
            <h2>{t("home.attention")} <span className="hm-count ltr">{rest.length}</span></h2>
            <ul>{rest.slice(0, SHOW).map(row)}</ul>
            {rest.length > SHOW && (
              <details className="hm-more">
                <summary>{t("home.more", { n: rest.length - SHOW })}</summary>
                <ul>{rest.slice(SHOW).map(row)}</ul>
              </details>)}
          </section>
        )}

        <LibraryPanel data={lib} q={q} kind={kind} open={open} />
      </main>
    </Shell>
  );
}
