"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import { flightLine, type LineLabels } from "@/lib/flight-line";
import type { Lang } from "@/lib/i18n";
import type { BoardRow } from "@/lib/flight-board";

type View = "now" | "list";
type Status = "all" | "attn" | "late" | "ground" | "soon" | "ok";
export type BoardLabels = Record<string, string> & LineLabels;

const MIN = 60000;
const hm = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const isMed = (r: BoardRow) => r.ftype === "medevac";
/** Needs the employee now. Old flights still open are NOT counted here: they live in their own single block. Ambulance flights always count. */
const needsYou = (r: BoardRow) => (r.attn || isMed(r)) && (!r.stale || isMed(r));

function matches(r: BoardRow, st: Status) {
  if (st === "all") return true;
  if (st === "attn") return needsYou(r);
  if (st === "late") return r.tone === "late";
  if (st === "ground") return r.code === "onGround";
  if (st === "soon") return r.code === "soon";
  return r.code === "onTime";
}

/** The moment that matters now for this flight: departed → when it left, on the ground → departure, otherwise arrival. */
const focusAt = (r: BoardRow) => (r.code === "departed" ? r.atd ?? r.dep : r.code === "onGround" ? r.dep : r.arr ?? r.dep);

export default function FlightsBoard({ rows, L, lang, now0, tab, q0, importHref, doneHref, activeHref }: { rows: BoardRow[]; L: BoardLabels; lang: Lang; now0: number; tab: "active" | "done"; q0: string; importHref: string; doneHref: string; activeHref: string }) {
  const [now, setNow] = useState(now0);
  const [q, setQ] = useState(q0);
  const [airline, setAirline] = useState("");
  const [station, setStation] = useState("");
  const [st, setSt] = useState<Status>("all");
  const [view, setView] = useState<View>("now");
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  const count = (k: (r: BoardRow) => string) => { const m = new Map<string, number>(); rows.forEach((r) => m.set(k(r), (m.get(k(r)) ?? 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };
  const airlines = useMemo(() => count((r) => r.airlineCode), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const stations = useMemo(() => count((r) => r.station ?? "—"), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => ({ all: rows.length, attn: rows.filter(needsYou).length, late: rows.filter((r) => r.tone === "late").length, ground: rows.filter((r) => r.code === "onGround").length, soon: rows.filter((r) => r.code === "soon").length, ok: rows.filter((r) => r.code === "onTime").length }), [rows]);

  const needle = q.trim().toLowerCase();
  const base = useMemo(() => rows.filter((r) => (!airline || r.airlineCode === airline) && (!station || (r.station ?? "—") === station) && matches(r, st) && (!needle || [r.flightIn, r.flightOut, r.origin, r.station, r.dest, r.reg, r.airlineName, r.airlineCode].some((x) => (x ?? "").toLowerCase().includes(needle)))), [rows, airline, station, st, needle]);

  /** Three zones: needs you (kept in the server's priority order, ambulance first), old flights still open (collapsed into ONE block), and everything else in time order. */
  const { attnRows, staleRows, rest } = useMemo(() => {
    const attnRows = tab === "active" ? base.filter(needsYou) : [];
    const staleRows = tab === "active" ? base.filter((r) => r.stale && !isMed(r)) : [];
    const used = new Set([...attnRows, ...staleRows].map((r) => r.id));
    const rest = base.filter((r) => !used.has(r.id)).sort((a, b) => tab === "done" ? (focusAt(b) ?? 0) - (focusAt(a) ?? 0) : (focusAt(a) ?? 9e15) - (focusAt(b) ?? 9e15));
    return { attnRows, staleRows, rest };
  }, [base, tab]);

  const effView: View = tab === "done" ? "list" : view;
  const { earlier, windowRows, later } = useMemo(() => {
    const lo = now - 60 * MIN, hi = now + 180 * MIN;
    const f = (r: BoardRow) => focusAt(r);
    return { earlier: rest.filter((r) => f(r) !== null && f(r)! < lo), windowRows: rest.filter((r) => f(r) !== null && f(r)! >= lo && f(r)! <= hi), later: rest.filter((r) => f(r) === null || f(r)! > hi) };
  }, [rest, now]);

  const days = useMemo(() => {
    const todayKey = new Date(now).toISOString().slice(0, 10); const tomKey = new Date(now + 86400000).toISOString().slice(0, 10);
    const m = new Map<string, { key: string; name: string; rows: BoardRow[] }>();
    rest.forEach((r) => { const g = m.get(r.dayKey) ?? { key: r.dayKey, name: r.dayKey === todayKey ? `${L.today} · ${r.dayLabel}` : r.dayKey === tomKey ? `${L.tomorrow} · ${r.dayLabel}` : r.dayLabel, rows: [] }; g.rows.push(r); m.set(r.dayKey, g); });
    return [...m.values()].sort((a, b) => (tab === "done" ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
  }, [rest, now, tab, L]);

  const anyFilter = !!(airline || station || st !== "all" || needle);
  const reset = () => { setAirline(""); setStation(""); setSt("all"); setQ(""); };
  const arrow = lang === "ar" ? "←" : "→";

  /** Thin bar: time on the ground against the planned ground time. Only for aircraft on the ground with a known plan. */
  const Otp = ({ r }: { r: BoardRow }) => {
    if (!r.ata || r.atd || !r.ground || r.ground <= 0) return null;
    const el = Math.max(0, (now - r.ata) / MIN); const left = r.ground - el;
    const lv = left < 0 ? "late" : left <= 10 ? "warn" : "ok";
    return <span className={`fb-otp ${lv}`} aria-hidden="true"><i style={{ width: `${clamp((el / r.ground) * 100)}%` }} /></span>;
  };

  const card = (r: BoardRow) => (
    <Link key={r.id} href={r.href} className={`fx-card t-${r.tone}${r.attn ? " attn" : ""}${isMed(r) ? " med" : ""}`}>
      <span className="fx-lg"><Logo url={r.logoUrl} code={r.airlineCode} name={r.airlineName} size="md" /></span>
      <span className="fx-id">
        <b className="ltr">{r.flightIn ?? "—"}{r.flightOut ? <small> / {r.flightOut}</small> : null}</b>
        <span className="fx-sub">{r.ftype !== "commercial" && <span className={`ftype ft-${r.ftype}`}>{L[`ft_${r.ftype}`]}</span>}<bdi>{r.airlineName}</bdi>{r.reg ? <> <span aria-hidden="true">·</span> <bdi className="ltr">{r.reg}</bdi></> : null}</span>
      </span>
      <span className="fx-route ltr">{r.origin ?? "—"} › <b>{r.station ?? "—"}</b> › {r.dest ?? "—"}</span>
      <span className="fx-seq">
        <span className="fx-t"><small>{r.ata ? L.arrDid : L.arrWill}</small><b className="ltr">{hm(r.arr)}</b></span>
        <i aria-hidden="true">{arrow}</i>
        <span className="fx-t"><small>{r.atd ? L.depDid : L.depWill}</small><b className="ltr">{hm(r.dep)}</b></span>
      </span>
      <span className="fx-line">{flightLine({ code: r.code, sta: r.sta, eta: r.eta, arr: r.arr, dep: r.dep, atd: r.atd, dueType: r.dueType, dueNow: r.dueNow }, now, lang, L)}</span>
      <Otp r={r} />
    </Link>
  );
  const cards = (xs: BoardRow[]) => <ul className="fx-list">{xs.map((r) => <li key={r.id}>{card(r)}</li>)}</ul>;

  const pills: [Status, string, number][] = [["all", L.kAll, kpi.all], ["attn", L.kAttn, kpi.attn], ["late", L.kLate, kpi.late], ["ground", L.kGround, kpi.ground], ["soon", L.kSoon, kpi.soon], ["ok", L.kOk, kpi.ok]];

  const staleDays = staleRows.map((r) => r.dayKey).filter((k) => k !== "none").sort();
  const staleLabel = (k: string) => staleRows.find((r) => r.dayKey === k)?.dayLabel ?? k;
  const staleSub = staleDays.length === 0 ? "" : staleDays[0] === staleDays[staleDays.length - 1] ? fill(L.staleSub1, { a: staleLabel(staleDays[0]) }) : fill(L.staleSub, { a: staleLabel(staleDays[0]), b: staleLabel(staleDays[staleDays.length - 1]) });

  const nowAt = windowRows.findIndex((r) => (focusAt(r) ?? 0) >= now);
  const nowIdx = nowAt === -1 ? windowRows.length : nowAt;
  const nowMark = <li key="now" className="fx-now" aria-label={L.now}><span>{L.now} · <span className="ltr">{hm(now)}</span></span></li>;
  const calm = tab === "active" && rows.length > 0 && !anyFilter && attnRows.length === 0 && staleRows.length === 0;

  return (
    <div className="fx">
      <header className="fx-hero">
        <div><h1>{L.title}</h1><p>{L.subtitle}</p></div>
        <div className="fx-ctl">
          <Link className="btn gold" href={importHref}>{L.importBtn}</Link>
          <Link className="btn" href="/agent">{L.askAgent}</Link>
        </div>
      </header>

      <div className="fx-bar">
        <input type="search" className="fb-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} />
        <div className="fb-seg" role="group" aria-label={L.tabAria}>
          <Link className={tab === "active" ? "on" : ""} href={activeHref}>{L.tabActive}</Link><Link className={tab === "done" ? "on" : ""} href={doneHref}>{L.tabDone}</Link>
        </div>
        {tab === "active" && <div className="fb-seg" role="group" aria-label={L.viewAria}>
          {([["now", L.vNow], ["list", L.vList]] as [View, string][]).map(([v, l]) => <button key={v} type="button" className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}
        </div>}
      </div>

      {rows.length > 0 && <div className="fx-pills" role="group" aria-label={L.kAria}>
        {pills.filter(([k, , n]) => k === "all" || n > 0 || st === k).map(([k, label, n]) => <button key={k} type="button" className={`fx-pill k-${k}${st === k ? " on" : ""}`} aria-pressed={st === k} onClick={() => setSt(st === k && k !== "all" ? "all" : k)}>{label}<b className="ltr">{n}</b></button>)}
        <span className="grow" />
        <details className="fx-adv" open={!!(airline || station)}>
          <summary className="fb-link">{L.filter}</summary>
          <div className="fb-meta">
            <select className="pick fb-sel" value={airline} onChange={(e) => setAirline(e.target.value)} aria-label={L.airlines}><option value="">{L.allAirlines}</option>{airlines.map(([a, n]) => <option key={a} value={a}>{a} ({n})</option>)}</select>
            <select className="pick fb-sel" value={station} onChange={(e) => setStation(e.target.value)} aria-label={L.stations}><option value="">{L.allStations}</option>{stations.map(([a, n]) => <option key={a} value={a}>{a} ({n})</option>)}</select>
          </div>
        </details>
        {anyFilter && <button type="button" className="fb-link" onClick={reset}>{L.clear}</button>}
      </div>}

      {base.length === 0 && <section className="card"><p className="muted">{rows.length === 0 ? (tab === "active" ? L.noneActive : L.noneDone) : L.noneMatch}</p></section>}
      {calm && <p className="fx-calm" role="status"><i aria-hidden="true" />{L.calm}</p>}

      {attnRows.length > 0 && <section className="fx-zone" aria-label={L.kAttn}>
        <h2 className="fx-gh">{L.kAttn}<b className="ltr">{attnRows.length}</b></h2>
        {cards(attnRows)}
      </section>}

      {staleRows.length > 0 && <details className="fx-stale">
        <summary><span className="fx-stale-t"><b>{fill(L.staleTitle, { n: staleRows.length })}</b>{staleSub && <small>{staleSub}</small>}</span><span className="btn sm gold">{L.staleBtn}</span></summary>
        {cards(staleRows)}
      </details>}

      {rest.length > 0 && effView === "now" && <section className="fx-zone">
        {earlier.length > 0 && <details className="fx-fold"><summary>{fill(L.earlier, { n: earlier.length })}</summary>{cards(earlier)}</details>}
        <ol className="fx-spine">
          {windowRows.slice(0, nowIdx).map((r) => <li key={r.id} className="fx-at"><span className="fx-hr"><bdi className="ltr">{hm(focusAt(r))}</bdi></span>{card(r)}</li>)}
          {nowMark}
          {windowRows.slice(nowIdx).map((r) => <li key={r.id} className="fx-at"><span className="fx-hr"><bdi className="ltr">{hm(focusAt(r))}</bdi></span>{card(r)}</li>)}
        </ol>
        {windowRows.length === 0 && <p className="muted fx-none">{L.quietWindow}</p>}
        {later.length > 0 && <details className="fx-fold"><summary>{fill(L.later, { n: later.length })}</summary>{cards(later)}</details>}
      </section>}

      {rest.length > 0 && effView === "list" && days.map((g) => <section key={g.key} className="fx-zone" aria-label={g.name}>
        <h2 className="fx-gh"><span className="ltr">{g.name}</span><b className="ltr">{g.rows.length}</b></h2>
        {cards(g.rows)}
      </section>)}
    </div>
  );
}
