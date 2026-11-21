import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import RqmDrafts from "@/components/RqmDrafts";
import FlightTypeSuggestions from "@/components/FlightTypeSuggestions";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import MessageComposer from "@/components/MessageComposer";
import MessageDrafts from "@/components/MessageDrafts";
import MovementLibrary from "@/components/MovementLibrary";
import DocsPanel from "@/components/DocsPanel";
import { getCommandCenter } from "@/lib/command-center";
import NowBar from "@/components/NowBar";
import OtpBlock from "@/components/OtpBlock";
import DelayForm from "@/components/DelayForm";
import "./flights.css";
import "./radar.css";
import GroundRadar from "@/components/GroundRadar";
import OtpGantt from "@/components/OtpGantt";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import { buildFeed, buildAudit, nextStep, withEndpoints, type FeedItem } from "@/lib/flight-feed";
import FlightsBoard from "@/components/FlightsBoard";
import { toBoardRows } from "@/lib/flight-board";
import ArrivalReply from "@/components/ArrivalReply";
import OtpStand from "@/components/OtpStand";
import OtpReel, { type ReelItem } from "@/components/OtpReel";
import { getOtp } from "@/lib/otp";
import { cardStatus } from "@/lib/flight-status";
import { durText } from "@/lib/dur";
import { flightLine, lineLabels } from "@/lib/flight-line";
import { dayShort } from "@/lib/flight-group";
import { getFlight, getFlightList, type FlightRow } from "@/lib/flights";
import { getFlightFileNo } from "@/lib/library";
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

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; sel?: string; tab?: string; view?: string; q?: string; day?: string; compose?: string }> }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const tab = sp.tab === "done" ? "done" : "active";
  const view = sp.view === "movement" || sp.view === "docs" ? sp.view : "overview";
  /** Old deep links (?view=handling|timeline|messages|delay) now open the matching section of the single flight file. */
  const focus = sp.view === "handling" || sp.view === "timeline" ? "handling" : sp.view === "messages" ? "messages" : sp.view === "delay" ? "delay" : null;
  const d = await getCommandData();
  const [all, sel] = await Promise.all([sp.id ? Promise.resolve([]) : getFlightList(tab, d.company.id), sp.id ? getFlight(sp.id, d.company.id) : Promise.resolve(null)]);
  const board = sp.id ? [] : toBoardRows(all, tab, t);
  /** Default flights screen = ground radar (active tab). The full filterable list stays at ?view=list and for the "done" tab. */
  const radar = !sp.id && tab === "active" && sp.view !== "list";
  const radarSel = radar ? (board.find((r) => r.id === sp.sel)?.id ?? board.filter((r) => r.code === "onGround").sort((a, b) => (a.dep ?? 9e15) - (b.dep ?? 9e15))[0]?.id ?? null) : null;
  const radarOtp = radarSel ? await getOtp(radarSel, lang) : null;
  const cc = sel && (view === "movement" || view === "docs") ? await getCommandCenter(d.company.id, sel.arrivalLeg) : null;
  const L = {
    title: t("fl.title"), subtitle: t("fl.subtitle"), importBtn: t("fl.import.btn"), askAgent: t("fl.askAgent"), search: t("fl.search.ph"),
    tabActive: t("fl.tab.active"), tabDone: t("fl.tab.done"), kAll: t("fl.b.kAll"), kAttn: t("fl.grp.attn"), kLate: t("fl.sum.late"), kGround: t("fl.cs.onGround"), kSoon: t("fl.sum.soon"), kOk: t("fl.sum.ok"),
    noneActive: t("fl.none.active"), noneDone: t("fl.none.done"), noneMatch: t("fl.none.match"),
    kAria: t("fl.b.kAria"), tabAria: t("fl.b.tabAria"), viewAria: t("fl.b.viewAria"), vNow: t("fx.view.now"), vList: t("fl.b.vList"),
    airlines: t("fl.b.airlines"), allAirlines: t("fl.b.allAirlines"), stations: t("fl.b.stations"), allStations: t("fl.b.allStations"), clear: t("fl.b.clear"), filter: t("fx.filter"),
    today: t("fl.grp.today"), tomorrow: t("fl.grp.tomorrow"), now: t("fl.now"),
    ft_private: t("fl.ft.private"), ft_cargo: t("fl.ft.cargo"), ft_medevac: t("fl.ft.medevac"),
    calm: t("fx.calm"), quietWindow: t("fx.quiet.window"),
    staleTitle: t("fx.stale.title", { n: "{n}" }), staleSub: t("fx.stale.sub", { a: "{a}", b: "{b}" }), staleSub1: t("fx.stale.sub1", { a: "{a}" }), staleBtn: t("fx.stale.btn"),
    earlier: t("fx.earlier", { n: "{n}" }), later: t("fx.later", { n: "{n}" }),
    arrWill: t("fx.arr.will"), arrDid: t("fx.arr.did"), depWill: t("fx.dep.will"), depDid: t("fx.dep.did"),
    ...lineLabels(t),
  };
  const f = sel?.file; const c = sel?.clock;
  const fileNo = f?.rotation_id ? await getFlightFileNo(String(f.rotation_id)) : null;
  const otp = sel && f ? await getOtp(String(f.rotation_id), lang) : null;
  const feedIn = sel ? { steps: sel.steps, questions: sel.questions, statements: sel.statements, mails: sel.mails, rqms: sel.rqms, criticalOpen: Number(f?.sop_critical_open ?? 0) } : null;
  const feed = feedIn && f && c ? withEndpoints(buildFeed(feedIn, t, lang), f, c, t) : null;
  const next = feedIn ? nextStep(feedIn, t) : null;
  const audit: FeedItem[] = sel ? buildAudit(sel, t, lang) : [];
  const nowMs = Date.now();
  const ms = (v: unknown) => (v ? +new Date(String(v)) : null);
  const status = sel && f ? cardStatus({ status: f.status, atd: f.atd, ata: f.ata, sta: f.sta, eta: f.eta ?? null } as unknown as FlightRow, t, nowMs) : null;
  const staMs = ms(f?.sta);
  /** The one thing the agent asks first: scheduled arrival passed and nothing recorded. */
  const waitingArrival = !!f && !f.ata && !f.atd && f.status !== "cancelled" && staMs !== null && staMs < nowMs;
  const dayWord = f?.sta ? (String(f.sta).slice(0, 10) === new Date(nowMs).toISOString().slice(0, 10) ? t("fx.d.dayToday") : t("fx.d.dayOn", { d: dayShort(String(f.sta)) })) : "";
  const arrAt = f ? (f.ata ?? f.eta ?? f.sta) : null; const depAt = f && c ? (f.atd ?? c.expected_std ?? f.std) : null;
  const headLine = f && c && status ? (waitingArrival
    ? t("fx.d.noArr", { who: String(f.registration ?? f.flight_in ?? ""), t: hm(f.sta), day: dayWord })
    : flightLine({ code: status.code, sta: staMs, eta: ms(f.eta), arr: ms(arrAt), dep: ms(depAt), atd: ms(f.atd) }, nowMs, lang, lineLabels(t))) : "";
  /** Flight reel strip 1: oldest to newest, what happened then what is still due. */
  const reelFlight: ReelItem[] = feed ? [...[...feed.done].reverse().map((x) => ({ ...x, done: true })), ...feed.waiting.map((x) => ({ ...x, done: false }))].map((x) => ({ id: x.id, at: x.at, tone: x.tone, title: x.title, detail: x.detail, href: x.href, done: x.done })) : [];
  const vh = (v: string) => `/flights?id=${f?.rotation_id}${tab === "done" ? "&tab=done" : ""}${v === "overview" ? "" : `&view=${v}`}`;

  return (
    <Shell data={d} module="flights">
      <main className="page">
        {radar && <GroundRadar rows={board} selId={radarSel} explicit={!!sp.sel} lang={lang === "ar" ? "ar" : "en"} listHref="/flights?view=list" importHref="/flights/import"
          stand={radarSel && radarOtp ? <OtpGantt otp={radarOtp} nowMs={Date.now()} lang={lang === "ar" ? "ar" : "en"} title={`${lang === "ar" ? "الوقفة" : "Stand"} — ${board.find((r) => r.id === radarSel)?.flightIn ?? ""}`} /> : <p className="rd-empty">{lang === "ar" ? "اختر رحلة على الأرض لعرض وقفتها." : "Pick a flight on the ground to see its stand."}</p>} />}
        {!sp.id && !radar && <FlightsBoard rows={board} L={L} lang={lang} now0={Date.now()} tab={tab} q0={sp.q ?? ""} importHref="/flights/import" activeHref="/flights" doneHref="/flights?tab=done" />}

        {sp.id && <Link className="back" href={tab === "done" ? "/flights?tab=done" : "/flights"}>‹ {t("fl.all")}</Link>}
        {sp.id && !sel && <section className="card"><p className="muted">{t("fl.notFound")}</p></section>}
        {sp.id && sel && f && c && <div className="detail ws">
              <header className="fx-head card">
                <div className="fx-head-top">
                  {sel.airline && <Logo url={sel.airline.logoUrl} code={sel.airline.code} name={sel.airline.name} size="md" />}
                  <div className="fx-head-id">
                    <b className="ltr fx-fn">{f.flight_in ?? "—"} / {f.flight_out ?? "—"}</b>
                    <small><bdi>{sel.airline?.name ?? sel.airline?.code ?? ""}</bdi>{f.registration ? <> <span aria-hidden="true">·</span> <bdi className="ltr">{f.registration}</bdi></> : null}</small>
                  </div>
                  {sel.flightType !== "commercial" && <span className={`ftype ft-${sel.flightType}`} title={sel.typeSource === "agent_suggested" ? t("fl.ft.suggested") : sel.typeSource === "employee_confirmed" ? t("fl.ft.confirmed") : undefined}>{t(`fl.ft.${sel.flightType}`)}</span>}
                <p className="fx-head-route ltr">{f.origin ?? "—"} › <b>{f.station ?? "—"}</b> › {f.destination ?? "—"}</p>
                  <span className="grow" />
                <div className="fx-head-times">
                  <span className="fx-seq">
                    <span className="fx-t"><small>{f.ata ? t("fx.arr.did") : t("fx.arr.will")}</small><b className="ltr">{hm(arrAt ? String(arrAt) : null)}</b><em className="ltr">{dayShort(arrAt ? String(arrAt) : null)}</em></span>
                    <i aria-hidden="true">{lang === "ar" ? "←" : "→"}</i>
                    <span className="fx-t"><small>{f.atd ? t("fx.dep.did") : t("fx.dep.will")}</small><b className="ltr">{hm(depAt ? String(depAt) : null)}</b><em className="ltr">{dayShort(depAt ? String(depAt) : null)}</em></span>
                  </span>
                  {c.planned_ground_minutes ? <small className="muted">{t("fx.d.ground", { d: durText(Number(c.planned_ground_minutes), lang) })}</small> : null}
                </div>
                  <Link className="btn sm ghost" href={`/agent?flight=${f.ata ? sel.departureLeg : sel.arrivalLeg}`}>{t("fl.askAgent")}</Link>
                </div>
                {waitingArrival
                  ? <ArrivalReply arrivalLeg={sel.arrivalLeg} text={headLine} canAct={sel.canAct} L={{ q: t("fx.d.arrived"), yes: t("fx.d.yes"), useNow: t("fx.d.useNow"), save: t("fl.tl.record"), back: t("fl.tl.back"), td: t("fx.d.td"), co: t("fx.d.co"), coHint: t("fx.d.coHint"), order: t("fx.d.order") }} />
                  : <div className={`fx-agent t-${status?.tone ?? "idle"}`}><i aria-hidden="true" /><p><span>{headLine}</span></p></div>}
              </header>
              <div className="fx-grid"><div className="fx-main">
              {!sel.canAct && <p role="alert" className="err">{t("fl.noEmp")}</p>}

              <FlightTypeSuggestions items={sel.typeSuggestions} canAct={sel.canAct} />

              {/* المطلوب الآن: بند واحد بارز، والباقي مطوي */}
              {<div id="sec-now" className="fsec">
                {sel.panel.needed.length > 0
                  ? <NowBar items={sel.panel.needed} t={t} folded={waitingArrival} composeHref={(ty) => `${vh("overview")}&compose=${encodeURIComponent(ty)}#compose`} />
                  : next && next.tone !== "ok" && !waitingArrival && <section className={`card reco next ${next.tone}`} aria-label={t("fl.next")}><span className="eye" aria-hidden="true" /><div><small className="muted">{t("fl.next")}</small><p>{next.text}</p></div>{next.href && <Link className="btn gold" href={next.href.startsWith("?") ? `${vh("overview")}&view=handling#handling` : next.href}>{next.action}</Link>}</section>}
                {sel.questions.length > 0 && <div className="card" id="questions"><h2>{t("fl.q.title")}<Hint>{t("fl.q.hint")}</Hint></h2>
                  <FlightQuestions questions={sel.questions} canAct={sel.canAct} />
                </div>}
                <RqmDrafts drafts={sel.rqms} canAct={sel.canAct} />
              </div>}

              {/* الأرض: كارت الوقفة (OTP stand) دايماً، وكتلة زمن الوقفة بعد وصول الطائرة فقط */}
              {(d.access.modules === null || d.access.modules.includes("otp")) && ((otp && f) || f.ata) && <div id="sec-otp" className="fsec">
                {otp && otp.status === "ok" && <section className="rd" dir={lang === "ar" ? "rtl" : "ltr"} style={{ padding: 10 }}><div className="rd-panel" style={{ padding: "0 10px 12px" }}><OtpGantt otp={otp} nowMs={nowMs} lang={lang === "ar" ? "ar" : "en"} title={lang === "ar" ? "الوقفة — الخط الزمني للخدمات" : "Stand — service timeline"} /></div></section>}
                {otp && f && <OtpStand otp={otp} rotationId={String(f.rotation_id)} canAct={sel.canAct} airline={sel.airline} flightLabel={`${f.flight_in ?? "—"} / ${f.flight_out ?? "—"}`} registration={f.registration ?? null} />}
                {(feed || f.ata) && <details className="card fold fx-otpmore" open={focus === "delay"}><summary>{lang === "ar" ? "تفاصيل الوقفة وتسجيل التأخير" : "Stand details & delay log"}</summary>
                {feed && <OtpReel rotationId={String(f.rotation_id)} arrivalLeg={sel.arrivalLeg} flight={reelFlight} steps={sel.steps} />}
                {f.ata && <OtpBlock t={t} o={{ ata: f.ata ? String(f.ata) : null, atd: f.atd ? String(f.atd) : null, std: f.std ? String(f.std) : null, expectedStd: c.expected_std ? String(c.expected_std) : null, plannedGroundMin: c.planned_ground_minutes ? Number(c.planned_ground_minutes) : null, now: nowMs }}
                  delayAction={<details className="otp-delay" open={focus === "delay"}><summary className="btn sm gold">{t("fl.otp.logDelay")}</summary><DelayForm flightId={sel.departureLeg} steps={sel.steps} codes={sel.delayCodes} statements={sel.statements} canAct={sel.canAct} /></details>} />}
                </details>}
              </div>}

              </div><aside className="fx-side">
              {/* القصة: اللي جاي ثم اللي حصل، عمودياً */}
              {feed && <div className="card" id="sec-timeline"><h2>{t("fl.tl.title")}<Hint>{t("fl.tl.hint")}</Hint></h2>
                {feed.waiting.length === 0 && feed.done.length === 0 && <p className="muted">{t("fl.feed.none")}</p>}
                <ol className="vt">
                  {[...feed.waiting].reverse().map((x) => <FeedRow key={x.id} x={x} wait t={t} />)}
                  {feed.waiting.length > 0 && <li className="now" aria-label={t("fl.now")}><i /><span>{t("fl.now")}</span></li>}
                  {feed.done.map((x) => <FeedRow key={x.id} x={x} t={t} />)}
                </ol>
              </div>}

              {/* صف هادئ في الآخر: المناولة، المراسلات، الحركة، المستندات، التدقيق */}
              <div className="fx-more">
              {fileNo && <Link className="card fold fold-link" href={`/?f=${encodeURIComponent(fileNo)}&fk=flight#library`}>{t("fl.libFile")} ›</Link>}
              {<details id="handling" className="card fold" open={focus === "handling"}><summary>{t("fl.more.handling")}</summary>
                <FlightTimeline steps={sel.steps} arrivalLeg={sel.arrivalLeg} canAct={sel.canAct} />
              </details>}

              {<details id="messages" className="card fold" open={!!sp.compose || focus === "messages"}><summary>{t("fl.more.messages")}{sel.mails.length ? ` (${sel.mails.length})` : ""}</summary>
                <div className="card"><h2>{t("fl.mails.title")}</h2>
                  {sel.mails.length === 0 && <p className="muted">{t("fl.mails.none")}</p>}
                  <ul className="mlist">{sel.mails.map((m) => <li key={m.triageId}><i className={`dot ${m.status === "new" ? "info" : "ok"}`} /><div><b><Link href={`/inbox?id=${m.triageId}`}><bdi>{m.subject ?? t("fl.mail.fallback")}</bdi></Link></b><small className="muted">{[m.from, m.at ? fmtUtc(m.at) : null, m.draft?.status === "draft" ? t("fl.mail.draftWaiting") : null].filter(Boolean).join(" · ")}</small></div></li>)}</ul>
                </div>
                <div id="compose"><MessageComposer key={sp.compose ?? "none"} companyId={d.company.id} messages={sel.panel.messages} delayCodes={sel.delayCodes} needed={sel.panel.needed} initialType={sp.compose} canAct={sel.canAct}
                  legs={[{ id: sel.arrivalLeg, label: String(f.flight_in ?? "arrival") }, { id: sel.departureLeg, label: String(f.flight_out ?? "departure") }]} /></div>
                <MessageDrafts drafts={sel.panel.drafts} canAct={sel.canAct} />
              </details>}

              {/* حركة الطائرة والمستندات: أقسام في نفس الملف. تُحمَّل بياناتها عند الفتح فقط (استعلام ثقيل) */}
              {view === "movement"
                ? <details id="movement" className="card fold" open><summary>{t("fl.mv.btn")}</summary>
                    {cc && !cc.ok && <p role="alert" className="err">{t("fl.err.generic")}</p>}
                    {cc?.ok && <MovementLibrary cc={cc.data} companyId={d.company.id} canAct={sel.canAct} delayCodes={sel.delayCodes} />}
                  </details>
                : <Link id="movement" className="card fold fold-link" href={`${vh("movement")}#movement`}>{t("fl.mv.btn")} ›</Link>}
              {view === "docs"
                ? <details id="docs" className="card fold" open><summary>{t("fl.doc.btn")}</summary>
                    {cc && !cc.ok && <p role="alert" className="err">{t("fl.err.generic")}</p>}
                    {cc?.ok && <DocsPanel cc={cc.data} />}
                  </details>
                : <Link id="docs" className="card fold fold-link" href={`${vh("docs")}#docs`}>{t("fl.doc.btn")} ›</Link>}

              {<details id="audit" className="card fold"><summary>{t("fl.more.audit")}</summary>
                {audit.length === 0 && <p className="muted">{t("fl.audit.none")}</p>}
                <ol className="vt plain">{audit.map((x) => <li key={x.id}><i className={`dot ${x.tone}`} /><div><b><bdi>{x.title}</bdi></b><small className="muted"><span className="ltr">{fmtUtc(x.at)}</span>{x.detail ? <> · <bdi>{x.detail}</bdi></> : null}</small></div></li>)}</ol>
              </details>}
              </div>
              </aside></div>
        </div>}
      </main>
    </Shell>
  );
}
