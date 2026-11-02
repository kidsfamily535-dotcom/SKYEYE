import Link from "next/link";
import Shell from "@/components/Shell";
import Logo from "@/components/Logo";
import RqmDrafts from "@/components/RqmDrafts";
import FlightQuestions from "@/components/FlightQuestions";
import FlightTimeline from "@/components/FlightTimeline";
import FlightActions from "@/components/FlightActions";
import DelayForm from "@/components/DelayForm";
import { getCommandData } from "@/lib/data";
import { fmtUtc } from "@/lib/format";
import Hint from "@/components/Hint";
import { buildFeed, nextStep, type FeedItem } from "@/lib/flight-feed";
import FlightCard from "@/components/FlightCard";
import FlightJourney from "@/components/FlightJourney";
import { buildJourney } from "@/lib/flight-journey";
import { summarize } from "@/lib/flight-status";
import { getFlight, getFlightList, type FlightRow } from "@/lib/flights";

const STATUS_AR: Record<string, string> = { scheduled: "مجدولة", delayed: "متأخرة", arrived: "وصلت", departed: "غادرت", cancelled: "ملغاة", diverted: "محوّلة" };
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

function FeedRow({ x, wait }: { x: FeedItem; wait?: boolean }) {
  return (
    <li className={wait ? "wait" : undefined}><i className={`dot ${wait ? "warn" : x.tone}`} /><div>
      <b>{x.href ? <Link href={x.href}><bdi>{x.title}</bdi></Link> : <bdi>{x.title}</bdi>}</b>
      <small className="muted"><span className="ltr">{fmtUtc(x.at)}</span>{wait ? " · الموعد" : ""}{x.detail ? <> · <bdi className="ltr">{x.detail}</bdi></> : null}</small>
    </div></li>
  );
}

export default async function FlightsPage({ searchParams }: { searchParams: Promise<{ id?: string; tab?: string; view?: string; q?: string; day?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "active";
  const view = sp.view === "timeline" ? "handling" : ["handling", "messages", "delay", "audit"].includes(sp.view ?? "") ? sp.view : "overview";
  const [d, all] = await Promise.all([getCommandData(), sp.id ? Promise.resolve([] as FlightRow[]) : getFlightList(tab)]);
  const sel = sp.id ? await getFlight(sp.id) : null;
  const needle = (sp.q ?? "").trim().toLowerCase();
  const todayIso = new Date().toISOString().slice(0, 10);
  const list = all.filter((r) => (!needle || [r.flightIn, r.flightOut, r.origin, r.station, r.destination, r.registration, r.airline?.name].some((x) => (x ?? "").toLowerCase().includes(needle))) && (sp.day !== "today" || (r.sta ?? r.std ?? "").slice(0, 10) === todayIso));
  const sum = summarize(all);
  const lh = (o: { tab?: string; day?: string }) => { const p = new URLSearchParams(); const t = o.tab ?? tab; if (t === "done") p.set("tab", "done"); const dd = "day" in o ? o.day : sp.day; if (dd) p.set("day", dd); if (needle) p.set("q", sp.q ?? ""); const s = p.toString(); return `/flights${s ? `?${s}` : ""}`; };
  const f = sel?.file; const c = sel?.clock;
  const feedIn = sel ? { steps: sel.steps, questions: sel.questions, statements: sel.statements, mails: sel.mails, rqms: sel.rqms, criticalOpen: Number(f?.sop_critical_open ?? 0) } : null;
  const journey = sel ? buildJourney(sel.file, sel.clock, sel.steps) : null;
  const feed = feedIn ? buildFeed(feedIn) : null; const next = feedIn ? nextStep(feedIn) : null;
  const audit: FeedItem[] = sel ? [
    ...sel.steps.filter((x) => x.state === "recorded" && x.actualAt).map((x) => ({ id: `a-${x.track}-${x.code}`, at: x.actualAt, kind: "step" as const, tone: x.wasCorrected ? "warn" as const : "ok" as const, title: `${x.wasCorrected ? "صُحِّح وقت" : "سُجّل وقت"} المرحلة: ${x.nameAr}`, detail: [x.code, x.by].filter(Boolean).join(" · ") })),
    ...sel.statements.map((x) => ({ id: `a-st-${x.id}`, at: x.at, kind: "statement" as const, tone: "warn" as const, title: `أُدخلت إفادة تأخير: ${x.reason}`, detail: [x.code, x.by].filter(Boolean).join(" · ") })),
    ...sel.rqms.filter((x) => x.sentAt).map((x) => ({ id: `a-rq-${x.id}`, at: x.sentAt, kind: "draft" as const, tone: "info" as const, title: x.followup ? "سُجّل إرسال متابعة RQM" : "سُجّل إرسال RQM", detail: undefined })),
  ].sort((a, b) => +new Date(b.at ?? 0) - +new Date(a.at ?? 0)) : [];
  const vh = (v: string) => `/flights?id=${f?.rotation_id}${tab === "done" ? "&tab=done" : ""}${v === "overview" ? "" : `&view=${v}`}`;
  const views: [string, string][] = [["overview", `نظرة عامة${sel && sel.questions.length ? ` (${sel.questions.length})` : ""}`], ["handling", "المناولة"], ["messages", `المراسلات${sel && sel.mails.length ? ` (${sel.mails.length})` : ""}`], ["delay", `الإفادات${sel && sel.statements.length ? ` (${sel.statements.length})` : ""}`], ["audit", "سجل التدقيق"]];

  return (
    <Shell data={d}>
      <main className="page">
        {!sp.id && <>
          <section className="fhero" aria-label="الرحلات"><h1>الرحلات</h1><p>كل الرحلات في مكان واحد مع متابعة الوكيل.</p></section>
          <div className="ffilters">
            <form method="get" action="/flights" className="grow" role="search">
              {tab === "done" && <input type="hidden" name="tab" value="done" />}{sp.day === "today" && <input type="hidden" name="day" value="today" />}
              <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="ابحث برقم الرحلة أو الوجهة…" aria-label="بحث في الرحلات" />
            </form>
            <Link className={`chip-link ${tab === "active" ? "on" : ""}`} href={lh({ tab: "active" })}>الحالية</Link>
            <Link className={`chip-link ${tab === "done" ? "on" : ""}`} href={lh({ tab: "done" })}>المنتهية</Link>
            <Link className={`chip-link ${sp.day === "today" ? "on" : ""}`} href={lh({ day: sp.day === "today" ? "" : "today" })}>اليوم</Link>
            <Link className="btn gold sm" href="/flights/import">رفع برنامج الرحلات</Link>
          </div>
          {list.length === 0 && <section className="card"><p className="muted">{needle || sp.day ? "لا نتائج مطابقة." : tab === "active" ? "لا توجد رحلات حالية. ارفع برنامج الرحلات من الزر أعلاه." : "لا توجد رحلات منتهية."}</p></section>}
          <ul className="flist">{list.map((r, i) => <FlightCard key={r.rotationId} r={r} hot={i === 0 && tab === "active"} href={`/flights?id=${r.rotationId}${tab === "done" ? "&tab=done" : ""}`} />)}</ul>
          {tab === "active" && <section className="fsum" aria-label="ملخص">
            <div><b className="ltr">{sum.today}</b><small>رحلات اليوم</small></div><div><b className="ltr">{sum.ok}</b><small>على الموعد</small></div>
            <div><b className="ltr">{sum.late}</b><small>متأخرة</small></div><div><b className="ltr">{sum.soon}</b><small>قادمة قريباً</small></div>
            <small className="muted">الحالة تُعرض فقط عند وجود دليل مسجّل</small>
          </section>}
        </>}

        {sp.id && <Link className="back" href={tab === "done" ? "/flights?tab=done" : "/flights"}>‹ كل الرحلات</Link>}
        {sp.id && !sel && <section className="card"><p className="muted">لم أجد هذه الرحلة.</p></section>}
        {sp.id && sel && f && c && <div className="detail ws">
              <header className="idbar card">
                {sel.airline && <Logo url={sel.airline.logoUrl} code={sel.airline.code} name={sel.airline.name} />}
                <div className="idmain">
                  <div className="idtop"><b className="ltr idfn">{f.flight_in ?? "—"} / {f.flight_out ?? "—"}</b>
                    <span className={`tag ${f.status === "delayed" ? "late" : "info"}`}>{STATUS_AR[f.status] ?? f.status}</span>
                    {Number(f.sop_critical_open) > 0 && <span className="tag warn">مراحل حرجة مفتوحة: <span className="ltr">{String(f.sop_critical_open)}</span></span>}</div>
                  <small className="ltr idroute">{f.origin ?? "—"} → {f.station ?? "—"} → {f.destination ?? "—"}{f.registration ? ` · ${f.registration}` : ""}</small>
                </div>
                <Link className="btn sm" href={`/agent?flight=${f.ata ? sel.departureLeg : sel.arrivalLeg}`}>اسأل الوكيل</Link>
                <dl className="idtimes">
                  <div><dt>وصول</dt><dd className="ltr">{hm(f.sta)}{f.ata ? <> · <b>{hm(f.ata)}</b></> : null}</dd></div>
                  <div><dt>مغادرة</dt><dd className="ltr">{hm(f.std)}{c.expected_std && c.expected_std !== f.std ? <> · <b>{hm(c.expected_std)}</b></> : null}</dd></div>
                  {c.arrival_delay_min !== null && c.arrival_delay_min !== undefined && Number(c.arrival_delay_min) !== 0 && <div><dt>تأخر الوصول</dt><dd className="ltr">{String(c.arrival_delay_min)} د</dd></div>}
                  {c.planned_ground_minutes ? <div><dt>زمن الأرض المخطط</dt><dd className="ltr">{String(c.planned_ground_minutes)} د</dd></div> : null}
                </dl>
              </header>
              {!sel.canAct && <p role="alert" className="err">حسابك غير مربوط بملف موظف، فلا يمكنك تسجيل أوقات أو إفادات. اطلب من المدير إضافتك.</p>}

              {next && feed && (
                <section className={`card reco next ${next.tone}`} aria-label="الخطوة الجاية"><span className="eye" aria-hidden="true" /><div><small className="muted">الخطوة الجاية</small><p>{next.text}</p></div>{next.href && <Link className="btn gold" href={next.href.startsWith("?") ? vh("handling") : next.href.startsWith("#") ? `${vh("overview")}${next.href}` : next.href}>{next.action}</Link>}</section>
              )}

              <div className="tabs views" role="tablist" aria-label="أقسام الرحلة">
                {views.map(([v, label]) => <Link key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} href={vh(v)}>{label}</Link>)}
              </div>

              {view === "overview" && next && feed && <>
                {journey && <FlightJourney j={journey} />}
                <RqmDrafts drafts={sel.rqms} canAct={sel.canAct} />
                {sel.questions.length > 0 && <div className="card" id="questions"><h2>أسئلة الوكيل<Hint>لا يسأل الوكيل عن مرحلة إلا إذا اعتُمدت مهلتها. المراحل بلا مهلة معتمدة تُسجَّل يدوياً من تبويب المناولة.</Hint></h2>
                  <FlightQuestions questions={sel.questions} canAct={sel.canAct} />
                </div>}
                <div className="card"><h2>خط الرحلة<Hint>إيميلات الرحلة والمسودات والمراحل وإفادات التأخير في خط واحد. لا يُعرض وقت إلا إذا كان مسجّلاً أو مخططاً.</Hint></h2>
                  {feed.waiting.length === 0 && feed.done.length === 0 && <p className="muted">لا أحداث على هذه الرحلة بعد.</p>}
                  <ol className="vt">
                    {[...feed.waiting].reverse().map((x) => <FeedRow key={x.id} x={x} wait />)}
                    {feed.waiting.length > 0 && <li className="now" aria-label="الآن"><i /><span>الآن</span></li>}
                    {feed.done.map((x) => <FeedRow key={x.id} x={x} />)}
                  </ol>
                </div>
              </>}

              {view === "handling" && <div className="card"><h2>مراحل المناولة</h2>
                <FlightTimeline steps={sel.steps} arrivalLeg={sel.arrivalLeg} canAct={sel.canAct} />
              </div>}

              {view === "messages" && <>
                <div className="card"><h2>الإيميلات المرتبطة</h2>
                  {sel.mails.length === 0 && <p className="muted">لا إيميلات مرتبطة بهذه الرحلة.</p>}
                  <ul className="mlist">{sel.mails.map((m) => <li key={m.triageId}><i className={`dot ${m.status === "new" ? "info" : "ok"}`} /><div><b><Link href={`/inbox?id=${m.triageId}`}><bdi>{m.subject ?? "إيميل"}</bdi></Link></b><small className="muted">{[m.from, m.at ? fmtUtc(m.at) : null, m.draft?.status === "draft" ? "مسودة بانتظارك" : null].filter(Boolean).join(" · ")}</small></div></li>)}</ul>
                </div>
                <FlightActions companyId={d.company.id} types={sel.messageTypes} canAct={sel.canAct}
                  legs={[{ id: sel.arrivalLeg, label: String(f.flight_in ?? "arrival") }, { id: sel.departureLeg, label: String(f.flight_out ?? "departure") }]} />
              </>}

              {view === "delay" && <div className="card"><h2>إفادات التأخير</h2>
                <DelayForm flightId={sel.departureLeg} steps={sel.steps} codes={sel.delayCodes} statements={sel.statements} canAct={sel.canAct} />
              </div>}

              {view === "audit" && <div className="card"><h2>سجل التدقيق<Hint>كل ما سُجّل على هذه الرحلة ومن سجّله ومتى. التصحيح حدث جديد يحل محل القديم ولا يمسحه.</Hint></h2>
                {audit.length === 0 && <p className="muted">لا شيء مسجّل على هذه الرحلة بعد.</p>}
                <ol className="vt plain">{audit.map((x) => <li key={x.id}><i className={`dot ${x.tone}`} /><div><b><bdi>{x.title}</bdi></b><small className="muted"><span className="ltr">{fmtUtc(x.at)}</span>{x.detail ? <> · <bdi>{x.detail}</bdi></> : null}</small></div></li>)}</ol>
              </div>}
        </div>}
      </main>
    </Shell>
  );
}
