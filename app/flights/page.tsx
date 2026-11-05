import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import RqmDrafts from "@/components/RqmDrafts";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import MessageComposer from "@/components/MessageComposer";
import MessageDrafts from "@/components/MessageDrafts";
import NowBar from "@/components/NowBar";
import DelayForm from "@/components/DelayForm";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import { buildFeed, nextStep, type FeedItem } from "@/lib/flight-feed";
import FlightsBoard from "@/components/FlightsBoard";
import { toBoardRows } from "@/lib/flight-board";
import FlightJourney from "@/components/FlightJourney";
import { buildJourney } from "@/lib/flight-journey";
import { dayShort } from "@/lib/flight-group";
import { getFlight, getFlightList, needsAction } from "@/lib/flights";
import { stepName } from "@/lib/step-name";
import { getT } from "@/lib/lang";
import { labelOf, type TFn } from "@/lib/i18n";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

function FeedRow({ x, wait, t }: { x: FeedItem; wait?: boolean; t: TFn }) {
  return (
    <li className={wait ? "wait" : undefined}><i className={`dot ${wait ? "warn" : x.tone}`} /><div>
      <b>{x.href ? <Link href={x.href}><bdi>{x.title}</bdi></Link> : <bdi>{x.title}</bdi>}</b>
      <small className="muted"><span className="ltr">{fmtUtc(x.at)}</span>{wait ? ` · ${t("fl.due")}` : ""}{x.detail ? <> · <bdi className="ltr">{x.detail}</bdi></> : null}</small>
    </div></li>
  );
}

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string; view?: string; q?: string; day?: string; compose?: string }> }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const tab = sp.tab === "done" ? "done" : "active";
  const view = sp.view === "timeline" ? "handling" : ["handling", "messages", "delay", "audit"].includes(sp.view ?? "") ? sp.view : "overview";
  const d = await getCommandData();
  const [all, sel] = await Promise.all([sp.id ? Promise.resolve([]) : getFlightList(tab, d.company.id), sp.id ? getFlight(sp.id, d.company.id) : Promise.resolve(null)]);
  const board = sp.id ? [] : toBoardRows(all, tab, t);
  const L = {
    title: t("fl.title"), subtitle: t("fl.subtitle"), importBtn: t("fl.import.btn"), askAgent: t("fl.askAgent"), search: t("fl.search.ph"),
    tabActive: t("fl.tab.active"), tabDone: t("fl.tab.done"), kAll: t("fl.b.kAll"), kAttn: t("fl.grp.attn"), kLate: t("fl.sum.late"), kGround: t("fl.cs.onGround"), kSoon: t("fl.sum.soon"), kOk: t("fl.sum.ok"),
    count: t("fl.grp.count", { n: "{n}" }), noneActive: t("fl.none.active"), noneDone: t("fl.none.done"), noneMatch: t("fl.none.match"),
    vHandling: t("fl.view.handling"), vMessages: t("fl.view.messages"), vDelay: t("fl.view.delay"),
    kAria: t("fl.b.kAria"), tabAria: t("fl.b.tabAria"), viewAria: t("fl.b.viewAria"), vBays: t("fl.b.vBays"), vTime: t("fl.b.vTime"), vList: t("fl.b.vList"),
    airlines: t("fl.b.airlines"), allAirlines: t("fl.b.allAirlines"), stations: t("fl.b.stations"), allStations: t("fl.b.allStations"), results: t("fl.b.results", { n: "{n}", m: "{m}" }),
    clear: t("fl.b.clear"), groupBy: t("fl.b.groupBy"), gStation: t("fl.b.gStation"), gAirline: t("fl.b.gAirline"), gDay: t("fl.b.gDay"), winAria: t("fl.b.winAria"), wAll: t("fl.b.wAll"), wRoll: t("fl.b.wRoll"),
    left: t("fl.b.left", { d: "{d}" }), over: t("fl.b.over", { d: "{d}" }), inT: t("fl.b.inT", { d: "{d}" }), agoT: t("fl.b.agoT", { d: "{d}" }), atd: t("fl.b.atd"),
    groundMin: t("fl.b.groundMin", { n: "{n}" }), close: t("fl.b.close"), from: t("fl.b.from"), to: t("fl.b.to"), station: t("fl.b.station"), eta: t("fl.b.eta"),
    today: t("fl.grp.today"), tomorrow: t("fl.grp.tomorrow"), stale: t("fl.grp.stale"),
    steps: t("fl.b.steps", { a: "{a}", b: "{b}" }), crit: t("fl.b.crit", { n: "{n}" }), open: t("fl.b.open"),
  };
  const f = sel?.file; const c = sel?.clock;
  const feedIn = sel ? { steps: sel.steps, questions: sel.questions, statements: sel.statements, mails: sel.mails, rqms: sel.rqms, criticalOpen: Number(f?.sop_critical_open ?? 0) } : null;
  const journey = sel ? buildJourney(sel.file, sel.clock, sel.steps, t, lang) : null;
  const feed = feedIn ? buildFeed(feedIn, t, lang) : null; const next = feedIn ? nextStep(feedIn, t) : null;
  const audit: FeedItem[] = sel ? [
    ...sel.steps.filter((x) => x.state === "recorded" && x.actualAt).map((x) => ({ id: `a-${x.track}-${x.code}`, at: x.actualAt, kind: "step" as const, tone: x.wasCorrected ? "warn" as const : "ok" as const, title: t(x.wasCorrected ? "fl.audit.corrected" : "fl.audit.recorded", { name: stepName(x, lang) }), detail: [x.code, x.by].filter(Boolean).join(" · ") })),
    ...sel.statements.map((x) => ({ id: `a-st-${x.id}`, at: x.at, kind: "statement" as const, tone: "warn" as const, title: t("fl.audit.statement", { reason: x.reason }), detail: [x.code, x.by].filter(Boolean).join(" · ") })),
    ...sel.rqms.filter((x) => x.sentAt).map((x) => ({ id: `a-rq-${x.id}`, at: x.sentAt, kind: "draft" as const, tone: "info" as const, title: t(x.followup ? "fl.audit.rqmFollow" : "fl.audit.rqm"), detail: undefined })),
  ].sort((a, b) => +new Date(b.at ?? 0) - +new Date(a.at ?? 0)) : [];
  const vh = (v: string) => `/flights?id=${f?.rotation_id}${tab === "done" ? "&tab=done" : ""}${v === "overview" ? "" : `&view=${v}`}`;
  const views: [string, string][] = [["overview", `${t("fl.view.overview")}${sel && sel.questions.length ? ` (${sel.questions.length})` : ""}`], ["handling", t("fl.view.handling")], ["messages", `${t("fl.view.messages")}${sel && sel.mails.length ? ` (${sel.mails.length})` : ""}`], ["delay", `${t("fl.view.delay")}${sel && sel.statements.length ? ` (${sel.statements.length})` : ""}`], ["audit", t("fl.view.audit")]];

  return (
    <Shell data={d}>
      <main className="page">
        {!sp.id && <FlightsBoard rows={board} L={L} now0={Date.now()} tab={tab} q0={sp.q ?? ""} importHref="/flights/import" activeHref="/flights" doneHref="/flights?tab=done" />}

        {sp.id && <Link className="back" href={tab === "done" ? "/flights?tab=done" : "/flights"}>‹ {t("fl.all")}</Link>}
        {sp.id && !sel && <section className="card"><p className="muted">{t("fl.notFound")}</p></section>}
        {sp.id && sel && f && c && <div className="detail ws">
              <header className="idbar card">
                {sel.airline && <Logo url={sel.airline.logoUrl} code={sel.airline.code} name={sel.airline.name} />}
                <div className="idmain">
                  <div className="idtop"><b className="ltr idfn">{f.flight_in ?? "—"} / {f.flight_out ?? "—"}</b>
                    <span className={`tag ${f.status === "delayed" ? "late" : "info"}`}>{labelOf(lang, "fl.status", f.status)}</span>
                    {Number(f.sop_critical_open) > 0 && <span className="tag warn">{t("fl.critOpen")} <span className="ltr">{String(f.sop_critical_open)}</span></span>}</div>
                  <small className="ltr idroute">{f.origin ?? "—"} → {f.station ?? "—"} → {f.destination ?? "—"}{f.registration ? ` · ${f.registration}` : ""}</small>
                </div>
                <Link className="btn sm" href={`/agent?flight=${f.ata ? sel.departureLeg : sel.arrivalLeg}`}>{t("fl.askAgent")}</Link>
                <dl className="idtimes">
                  <div><dt>{t("fl.arr")}</dt><dd className="ltr">{hm(f.sta)}{f.ata ? <> · <b>{hm(f.ata)}</b></> : null}<small className="fday">{dayShort(f.ata ?? f.sta)}</small></dd></div>
                  <div><dt>{t("fl.dep")}</dt><dd className="ltr">{hm(f.std)}{c.expected_std && c.expected_std !== f.std ? <> · <b>{hm(c.expected_std)}</b></> : null}<small className="fday">{dayShort(c.expected_std ?? f.std)}</small></dd></div>
                  {c.arrival_delay_min !== null && c.arrival_delay_min !== undefined && Number(c.arrival_delay_min) !== 0 && <div><dt>{t("fl.arrDelay")}</dt><dd className="ltr">{t("fl.min", { n: String(c.arrival_delay_min) })}</dd></div>}
                  {c.planned_ground_minutes ? <div><dt>{t("fl.plannedGround")}</dt><dd className="ltr">{t("fl.min", { n: String(c.planned_ground_minutes) })}</dd></div> : null}
                </dl>
              </header>
              {!sel.canAct && <p role="alert" className="err">{t("fl.noEmp")}</p>}

              <NowBar items={sel.panel.needed} t={t} composeHref={(ty) => `${vh("messages")}&compose=${encodeURIComponent(ty)}#compose`} />

              {next && feed && (
                <section className={`card reco next ${next.tone}`} aria-label={t("fl.next")}><span className="eye" aria-hidden="true" /><div><small className="muted">{t("fl.next")}</small><p>{next.text}</p></div>{next.href && <Link className="btn gold" href={next.href.startsWith("?") ? vh("handling") : next.href.startsWith("#") ? `${vh("overview")}${next.href}` : next.href}>{next.action}</Link>}</section>
              )}

              <div className="tabs views" role="tablist" aria-label={t("fl.views.aria")}>
                {views.map(([v, label]) => <Link key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} href={vh(v)}>{label}</Link>)}
              </div>

              {view === "overview" && next && feed && <>
                {journey && <FlightJourney j={journey} />}
                <RqmDrafts drafts={sel.rqms} canAct={sel.canAct} />
                {sel.questions.length > 0 && <div className="card" id="questions"><h2>{t("fl.q.title")}<Hint>{t("fl.q.hint")}</Hint></h2>
                  <FlightQuestions questions={sel.questions} canAct={sel.canAct} />
                </div>}
                <div className="card"><h2>{t("fl.feed.title")}<Hint>{t("fl.feed.hint")}</Hint></h2>
                  {feed.waiting.length === 0 && feed.done.length === 0 && <p className="muted">{t("fl.feed.none")}</p>}
                  <ol className="vt">
                    {[...feed.waiting].reverse().map((x) => <FeedRow key={x.id} x={x} wait t={t} />)}
                    {feed.waiting.length > 0 && <li className="now" aria-label={t("fl.now")}><i /><span>{t("fl.now")}</span></li>}
                    {feed.done.map((x) => <FeedRow key={x.id} x={x} t={t} />)}
                  </ol>
                </div>
              </>}

              {view === "handling" && <div className="card"><h2>{t("fl.handling.title")}</h2>
                <FlightTimeline steps={sel.steps} arrivalLeg={sel.arrivalLeg} canAct={sel.canAct} />
              </div>}

              {view === "messages" && <>
                <div className="card"><h2>{t("fl.mails.title")}</h2>
                  {sel.mails.length === 0 && <p className="muted">{t("fl.mails.none")}</p>}
                  <ul className="mlist">{sel.mails.map((m) => <li key={m.triageId}><i className={`dot ${m.status === "new" ? "info" : "ok"}`} /><div><b><Link href={`/inbox?id=${m.triageId}`}><bdi>{m.subject ?? t("fl.mail.fallback")}</bdi></Link></b><small className="muted">{[m.from, m.at ? fmtUtc(m.at) : null, m.draft?.status === "draft" ? t("fl.mail.draftWaiting") : null].filter(Boolean).join(" · ")}</small></div></li>)}</ul>
                </div>
                <div id="compose"><MessageComposer key={sp.compose ?? "none"} companyId={d.company.id} messages={sel.panel.messages} delayCodes={sel.delayCodes} needed={sel.panel.needed} initialType={sp.compose} canAct={sel.canAct}
                  legs={[{ id: sel.arrivalLeg, label: String(f.flight_in ?? "arrival") }, { id: sel.departureLeg, label: String(f.flight_out ?? "departure") }]} /></div>
                <MessageDrafts drafts={sel.panel.drafts} canAct={sel.canAct} />
              </>}

              {view === "delay" && <div className="card"><h2>{t("fl.delay.title")}</h2>
                <DelayForm flightId={sel.departureLeg} steps={sel.steps} codes={sel.delayCodes} statements={sel.statements} canAct={sel.canAct} />
              </div>}

              {view === "audit" && <div className="card"><h2>{t("fl.audit.title")}<Hint>{t("fl.audit.hint")}</Hint></h2>
                {audit.length === 0 && <p className="muted">{t("fl.audit.none")}</p>}
                <ol className="vt plain">{audit.map((x) => <li key={x.id}><i className={`dot ${x.tone}`} /><div><b><bdi>{x.title}</bdi></b><small className="muted"><span className="ltr">{fmtUtc(x.at)}</span>{x.detail ? <> · <bdi>{x.detail}</bdi></> : null}</small></div></li>)}</ol>
              </div>}
        </div>}
      </main>
    </Shell>
  );
}
