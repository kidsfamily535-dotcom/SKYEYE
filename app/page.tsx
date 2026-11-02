import Link from "next/link";
import Shell from "@/components/Shell";
import Radar from "@/components/Radar";
import { getCommandData, type Decision } from "@/lib/data";
import { getCockpit } from "@/lib/cockpit";
import { getT } from "@/lib/lang";
import { fwd, type Key } from "@/lib/i18n";

const dash = (n: number | null) => (n ?? "—");
const RANK: Record<string, number> = { late: 0, warn: 1, info: 2, ok: 3 };
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

function greeting(now: Date) {
  const h = +new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(now) % 24;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "short" }).format(now);
  const key: Key = h >= 5 && h < 12 ? "home.greet.morning" : h >= 12 ? "home.greet.evening" : "home.greet.night";
  return { key, date };
}

export default async function CommandPage() {
  const [d, c] = await Promise.all([getCommandData(), getCockpit()]);
  const { t, lang } = await getT();
  const g = greeting(new Date());
  const go = fwd(lang);
  const stream: Decision[] = [...c.flightDecisions, ...d.decisions].sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  const attention = (d.counts.urgentAlerts ?? 0) + (c.delayed ?? 0);
  const first = stream[0];
  const reco = d.noMembership ? null
    : stream.length === 0 ? t("home.reco.none")
    : t(stream.length === 1 ? "home.reco.one" : "home.reco.many", { n: stream.length, first: short(first.text) });

  const stat = (n: number | null | undefined, label: string, href: string, hot?: boolean) => (
    <Link href={href} className="gl hstat"><b className={`ltr ${hot ? "hot" : ""}`}>{d.noMembership ? "—" : dash(n ?? null)}</b><small>{label}</small></Link>);

  const chip = (href: string, label: string) => <Link href={href} className="hchip">{label}</Link>;

  return (
    <Shell data={d}>
      <main className="page home">
        <section className="hhero" aria-label={t("nav.home")}>
          <div className="gl hradar">
            <div className="ttl"><span className="livedot" aria-hidden="true" />{t("home.radar")}</div>
            <Radar counts={c.radar} />
          </div>
          <div className="hhero-main">
            <div className="gl hgreet">
              <h1>{t("home.title", { greet: t(g.key) })}</h1>
              <p><span className="ltr">{g.date}</span> · {t("home.subtitle")}</p>
            </div>
            <div className="hchips">
              {chip("/agent", t("nav.agent"))}
              {chip("/inbox", t("home.chip.drafts"))}
              {chip("#attention", t("home.chip.alerts"))}
              {chip("/handover", t("shell.handover"))}
            </div>
          </div>
        </section>

        <section className="hstats" aria-label={t("home.stats.aria")}>
          {stat(c.todayFlights, t("home.stat.today"), "/flights?day=today")}
          {stat(c.onGround, t("home.stat.ground"), "/flights")}
          {stat(attention, t("home.stat.attention"), "#attention", attention > 0)}
          {stat(d.counts.inboxToReview, t("home.stat.emails"), "/inbox?f=new")}
        </section>

        {reco && (
          <section className="reco gl" aria-label={t("home.reco.title")}>
            <span className="eye" aria-hidden="true" />
            <div><small className="muted">{t("home.reco.title")}</small><p>{reco}</p></div>
            {first?.href && <Link className="btn gold" href={first.href}>{first.action}</Link>}
          </section>
        )}

        <div className="cols2">
          <section id="attention" aria-label={t("home.attention")}>
            <h2 className="sec">{t("home.attention")}</h2>
            {d.noMembership && <div className="card gl"><p className="muted">{t("home.noMembership")}</p></div>}
            {!d.noMembership && stream.length === 0 && <div className="card gl"><p className="muted">{t("home.nothing")}</p></div>}
            <ul className="flist">{stream.map((x, i) => (
              <li key={x.id} className={`fcard ${i === 0 && x.tone === "late" ? "hot" : ""}`}>
                <div className="arow">
                  <span className={`fstatus ${x.tone === "ok" ? "ok" : x.tone}`}><b>{t(`tone.${x.tone}` as Key)}</b></span>
                  <span className="atext"><bdi>{x.text}</bdi></span>
                  {x.href ? <Link className={`btn sm ${i === 0 ? "gold" : ""}`} href={x.href}>{x.action}</Link> : null}
                </div>
              </li>))}
            </ul>
          </section>
          <div className="side-col">
            <section className="card gl hqa">
              <h2>{t("home.qa")}</h2>
              <div className="stack">
                <Link className="qa gold" href="/inbox?f=new">{t("home.qa.inbox")}<span aria-hidden="true">+</span></Link>
                <Link className="qa" href="/flights?day=today">{t("home.stat.today")}<span aria-hidden="true">{go}</span></Link>
                <Link className="qa" href="/handover">{t("home.qa.shift")}<span aria-hidden="true">{go}</span></Link>
                <Link className="qa" href="/agent">{t("nav.agent")}<span aria-hidden="true">{go}</span></Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
