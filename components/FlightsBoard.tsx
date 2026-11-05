"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import type { BoardRow } from "@/lib/flight-board";

type View = "bays" | "time" | "list";
type Group = "station" | "airline" | "day";
type Status = "all" | "attn" | "late" | "ground" | "soon" | "ok";
export type BoardLabels = Record<string, string>;

const hm = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const dur = (m: number) => { const a = Math.abs(Math.round(m)); const h = Math.floor(a / 60); return h ? `${h}h ${String(a % 60).padStart(2, "0")}m` : `${a}m`; };
const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));

function matches(r: BoardRow, st: Status) {
  if (st === "all") return true;
  if (st === "attn") return r.attn;
  if (st === "late") return r.tone === "late";
  if (st === "ground") return r.code === "onGround";
  if (st === "soon") return r.code === "soon";
  return r.code === "onTime";
}

export default function FlightsBoard({ rows, L, now0, tab, q0, importHref, doneHref, activeHref }: { rows: BoardRow[]; L: BoardLabels; now0: number; tab: "active" | "done"; q0: string; importHref: string; doneHref: string; activeHref: string }) {
  const [now, setNow] = useState(now0);
  const [q, setQ] = useState(q0);
  const [airline, setAirline] = useState("");
  const [station, setStation] = useState("");
  const [st, setSt] = useState<Status>("all");
  const [view, setView] = useState<View>("bays");
  const [group, setGroup] = useState<Group>("day");
  const [win, setWin] = useState<"all" | "roll">("all");
  const [dayF, setDayF] = useState<"all" | "today">("all");
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!sel) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setSel(null); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [sel]);

  const count = (k: (r: BoardRow) => string) => { const m = new Map<string, number>(); rows.forEach((r) => m.set(k(r), (m.get(k(r)) ?? 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]); };
  const airlines = useMemo(() => count((r) => r.airlineCode), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const stations = useMemo(() => count((r) => r.station ?? "—"), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const kpi = useMemo(() => ({ all: rows.length, attn: rows.filter((r) => r.attn).length, late: rows.filter((r) => r.tone === "late").length, ground: rows.filter((r) => r.code === "onGround").length, soon: rows.filter((r) => r.code === "soon").length, ok: rows.filter((r) => r.code === "onTime").length }), [rows]);

  const needle = q.trim().toLowerCase();
  const todayKey = new Date(now).toISOString().slice(0, 10); const tomKey = new Date(now + 86400000).toISOString().slice(0, 10);
  const list = useMemo(() => rows.filter((r) => (dayF === "all" || (r.dayKey === todayKey && !r.stale)) && (!airline || r.airlineCode === airline) && (!station || (r.station ?? "—") === station) && matches(r, st) && (!needle || [r.flightIn, r.flightOut, r.origin, r.station, r.dest, r.reg, r.airlineName, r.airlineCode].some((x) => (x ?? "").toLowerCase().includes(needle)))), [rows, airline, station, st, needle, dayF, todayKey]);

  const groups = useMemo(() => {
    const key = (r: BoardRow) => (group === "station" ? r.station ?? "—" : group === "airline" ? r.airlineCode : r.stale ? "~stale" : r.dayKey);
    const name = (r: BoardRow) => (group === "station" ? r.station ?? "—" : group === "airline" ? r.airlineName : r.stale ? L.stale : r.dayKey === todayKey ? `${L.today} · ${r.dayLabel}` : r.dayKey === tomKey ? `${L.tomorrow} · ${r.dayLabel}` : r.dayLabel);
    const m = new Map<string, { key: string; name: string; rows: BoardRow[] }>();
    list.forEach((r) => { const k = key(r); const g = m.get(k) ?? { key: k, name: name(r), rows: [] }; g.rows.push(r); m.set(k, g); });
    const out = [...m.values()];
    out.forEach((g) => g.rows.sort((a, b) => Number(b.attn) - Number(a.attn) || (a.arr ?? 9e15) - (b.arr ?? 9e15)));
    out.sort((a, b) => group === "day" ? a.key.localeCompare(b.key) : b.rows.filter((r) => r.attn).length - a.rows.filter((r) => r.attn).length || b.rows.length - a.rows.length);
    return out;
  }, [list, group, todayKey, tomKey, L]);

  const [lo, hi] = useMemo(() => {
    if (win === "roll") return [now - 2 * 3600e3, now + 10 * 3600e3];
    const xs = list.flatMap((r) => [r.arr, r.dep]).filter((x): x is number => x !== null);
    if (!xs.length) return [now - 3600e3, now + 6 * 3600e3];
    return [Math.min(...xs, now) - 1800e3, Math.max(...xs, now) + 1800e3];
  }, [list, win, now]);
  const pc = (v: number) => clamp(((v - lo) / (hi - lo)) * 100);
  const ticks = useMemo(() => { const out: number[] = []; const span = (hi - lo) / 3600e3; const step = span > 30 ? 6 : span > 14 ? 3 : 1; for (let t = Math.ceil(lo / 3600e3 / step) * step * 3600e3; t <= hi; t += step * 3600e3) out.push(t); return out; }, [lo, hi]);

  const cur = sel ? rows.find((r) => r.id === sel) ?? null : null;
  const anyFilter = !!(dayF !== "all" || airline || station || st !== "all" || needle);
  const reset = () => { setDayF("all"); setAirline(""); setStation(""); setSt("all"); setQ(""); };

  const minsLine = (r: BoardRow) => {
    if (r.code === "departed" || r.code === "cancelled") return r.atd ? `${L.atd} ${hm(r.atd)}` : "";
    if (r.code === "onGround" && r.dep) { const m = (r.dep - now) / 60000; return m >= 0 ? fill(L.left, { d: dur(m) }) : fill(L.over, { d: dur(m) }); }
    if (r.arr) { const m = (r.arr - now) / 60000; return m >= 0 ? fill(L.inT, { d: dur(m) }) : fill(L.agoT, { d: dur(m) }); }
    return "";
  };
  const prog = (r: BoardRow) => (r.code === "departed" ? 100 : r.arr && r.dep && r.dep > r.arr && now >= r.arr ? clamp(((now - r.arr) / (r.dep - r.arr)) * 100) : 0);

  const Mark = ({ r }: { r: BoardRow }) => r.attn ? <span className="fb-mark">{r.alerts > 0 && r.level ? <span className={`amark ${r.level}`}>{r.level}{r.alerts > 1 ? <small>×{r.alerts}</small> : null}</span> : null}{r.dueType ? <span className={`amark task ${r.dueNow ? "now" : ""}`}>{r.dueType}</span> : null}</span> : null;

  const kpis: [Status, string, number][] = [["all", L.kAll, kpi.all], ["attn", L.kAttn, kpi.attn], ["late", L.kLate, kpi.late], ["ground", L.kGround, kpi.ground], ["soon", L.kSoon, kpi.soon], ["ok", L.kOk, kpi.ok]];

  return (
    <div className="fb">
      <section className="fb-hero" aria-label={L.title}>
        <div className="fb-hd"><div><h1>{L.title}</h1><p>{L.subtitle}</p></div>
          <div className="fb-tools">
            <Link className="btn gold" href={importHref}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>{L.importBtn}</Link>
            <Link className="btn" href="/agent">{L.askAgent}</Link>
          </div></div>
        <div className="fb-kpis" role="group" aria-label={L.kAria}>
          {kpis.map(([k, label, n]) => <button key={k} type="button" className={`fb-kpi k-${k} ${st === k ? "on" : ""}`} aria-pressed={st === k} onClick={() => setSt(st === k && k !== "all" ? "all" : k)}><b className="ltr">{n}</b><small>{label}</small></button>)}
        </div>
      </section>

      <div className="fb-bar">
        <input type="search" className="fb-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} />
        <div className="fb-seg" role="group" aria-label={L.tabAria}>
          <Link className={tab === "active" ? "on" : ""} href={activeHref}>{L.tabActive}</Link><Link className={tab === "done" ? "on" : ""} href={doneHref}>{L.tabDone}</Link>
        </div>
        <button type="button" className={`fb-chip ${dayF === "today" ? "on" : ""}`} aria-pressed={dayF === "today"} onClick={() => setDayF(dayF === "today" ? "all" : "today")}>{L.today}<small className="ltr">{rows.filter((r) => r.dayKey === todayKey && !r.stale).length}</small></button>
        <div className="fb-seg" role="group" aria-label={L.viewAria}>
          {([["bays", L.vBays], ["time", L.vTime], ["list", L.vList]] as [View, string][]).map(([v, l]) => <button key={v} type="button" className={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>)}
        </div>
      </div>

      <div className="fb-chips" aria-label={L.airlines}>
        <button type="button" className={`fb-chip ${!airline ? "on" : ""}`} aria-pressed={!airline} onClick={() => setAirline("")}>{L.allAirlines}</button>
        {airlines.map(([a, n]) => <button key={a} type="button" className={`fb-chip ${airline === a ? "on" : ""}`} aria-pressed={airline === a} onClick={() => setAirline(airline === a ? "" : a)}><span className="ltr">{a}</span><small>{n}</small></button>)}
      </div>
      <div className="fb-chips" aria-label={L.stations}>
        <button type="button" className={`fb-chip ${!station ? "on" : ""}`} aria-pressed={!station} onClick={() => setStation("")}>{L.allStations}</button>
        {stations.map(([a, n]) => <button key={a} type="button" className={`fb-chip ${station === a ? "on" : ""}`} aria-pressed={station === a} onClick={() => setStation(station === a ? "" : a)}><span className="ltr">{a}</span><small>{n}</small></button>)}
      </div>
      <div className="fb-meta">
        <span role="status">{fill(L.results, { n: list.length, m: rows.length })}</span>
        {anyFilter && <button type="button" className="fb-link" onClick={reset}>{L.clear}</button>}
        <span className="grow" />
        <label className="fb-grp">{L.groupBy}
          <select className="pick" value={group} onChange={(e) => setGroup(e.target.value as Group)}><option value="station">{L.gStation}</option><option value="airline">{L.gAirline}</option><option value="day">{L.gDay}</option></select></label>
        {view === "time" && <div className="fb-seg sm" role="group" aria-label={L.winAria}><button type="button" className={win === "all" ? "on" : ""} aria-pressed={win === "all"} onClick={() => setWin("all")}>{L.wAll}</button><button type="button" className={win === "roll" ? "on" : ""} aria-pressed={win === "roll"} onClick={() => setWin("roll")}>{L.wRoll}</button></div>}
      </div>

      {list.length === 0 && <section className="card"><p className="muted">{rows.length === 0 ? (tab === "active" ? L.noneActive : L.noneDone) : L.noneMatch}</p></section>}

      {groups.map((g) => (
        <section key={g.key} className="fb-group" aria-label={g.name}>
          <h2 className="fb-gh"><span className="ltr">{g.name}</span><small>{fill(L.count, { n: g.rows.length })}</small>{g.rows.some((r) => r.attn) && <span className="amark L3">{g.rows.filter((r) => r.attn).length}</span>}</h2>

          {view === "bays" && <ul className="fb-bays">{g.rows.map((r) => (
            <li key={r.id}><button type="button" className={`fb-bay t-${r.tone} ${r.code === "scheduled" || r.code === "soon" || r.code === "unknown" ? "far" : ""} ${sel === r.id ? "on" : ""}`} onClick={() => setSel(r.id)} aria-label={`${r.flightIn ?? r.flightOut ?? ""} ${r.reg ?? ""} ${r.label}`}>
              <span className="fb-top"><span className="fb-st">{r.label}{r.sub ? ` · ${r.sub}` : ""}</span><Mark r={r} /></span>
              <span className="fb-stage">{r.logoUrl ? <img className="fb-lg" src={r.logoUrl} alt={r.airlineName} /> : <b className="fb-lg fb-lgt ltr">{r.airlineCode}</b>}<small className="fb-an">{r.airlineName}</small></span>
              <span className="fb-id"><span className="ltr"><b>{r.flightIn ?? "—"}</b>{r.flightOut ? <small> · {r.flightOut}</small> : null}</span></span>
              {r.reg && <span className="fb-reg ltr">{r.reg}</span>}
              <span className="fb-route ltr">{r.origin ?? "—"} › <b>{r.station ?? "—"}</b> › {r.dest ?? "—"}</span>
              <span className="fb-gr ltr" aria-hidden="true"><i style={{ width: `${prog(r)}%` }} /></span>
              <span className="fb-tm ltr"><span>{hm(r.arr)}</span><em>{minsLine(r)}</em><span>{hm(r.dep)}</span></span>
            </button></li>))}</ul>}

          {view === "time" && <div className="fb-tl">
            <div className="fb-axis ltr" aria-hidden="true">{ticks.map((t) => <span key={t} style={{ left: `${pc(t)}%` }}>{hm(t)}</span>)}</div>
            {g.rows.map((r) => { const a = r.arr, d = r.dep; const pa = a !== null ? pc(a) : null, pd = d !== null ? pc(d) : null; const nowp = (now - lo) / (hi - lo) * 100;
              return (<button key={r.id} type="button" className={`fb-lane t-${r.tone} ${sel === r.id ? "on" : ""}`} onClick={() => setSel(r.id)}>
                <span className="fb-lh"><Logo url={r.logoUrl} code={r.airlineCode} name={r.airlineName} /><b className="ltr">{r.flightIn ?? "—"}{r.flightOut ? ` · ${r.flightOut}` : ""}</b><span className="fb-reg ltr">{r.reg ?? ""}</span><span className="fb-st">{r.label}</span><Mark r={r} /><small className="ltr fb-rt">{r.origin ?? "—"} › {r.station ?? "—"} › {r.dest ?? "—"}</small></span>
                <span className="fb-trk ltr">{ticks.map((t) => <i key={t} className="gl" style={{ left: `${pc(t)}%` }} />)}{nowp >= 0 && nowp <= 100 && <i className="nw" style={{ left: `${nowp}%` }} />}
                  {pa !== null && pd !== null && <i className="sg" style={{ left: `${Math.min(pa, pd)}%`, width: `${Math.max(Math.abs(pd - pa), 0.8)}%` }} />}
                  {pa !== null && <i className={`pt ${a! < lo ? "cl" : ""}`} style={{ left: `${pa}%` }} />}{pd !== null && <i className={`pt dp ${d! > hi ? "cl" : ""}`} style={{ left: `${pd}%` }} />}
                  <span className="fb-tt">{hm(a)} → {hm(d)}{r.ground !== null ? ` · ${fill(L.groundMin, { n: r.ground })}` : ""}</span></span>
              </button>); })}
          </div>}

          {view === "list" && <ul className="fb-rows">{g.rows.map((r) => (
            <li key={r.id}><button type="button" className={`fb-row t-${r.tone} ${sel === r.id ? "on" : ""}`} onClick={() => setSel(r.id)}>
              <span className="fb-st">{r.label}</span><Logo url={r.logoUrl} code={r.airlineCode} name={r.airlineName} /><b className="ltr">{r.flightIn ?? "—"}</b><span className="ltr fb-rt">{r.origin ?? "—"} › {r.station ?? "—"} › {r.dest ?? "—"}</span><span className="ltr fb-t2">{hm(r.arr)} → {hm(r.dep)}</span><Mark r={r} /></button></li>))}</ul>}
        </section>))}

      {cur && <>
        <div className="fb-scrim" onClick={() => setSel(null)} aria-hidden="true" />
        <aside className={`fb-sheet t-${cur.tone}`} role="dialog" aria-modal="true" aria-label={cur.flightIn ?? cur.flightOut ?? ""}>
          <button type="button" className="fb-x btn ghost" onClick={() => setSel(null)} aria-label={L.close}>✕</button>
          <header className="fb-sh"><Logo url={cur.logoUrl} code={cur.airlineCode} name={cur.airlineName} size="md" /><div><b className="ltr fb-fn">{cur.flightIn ?? "—"} / {cur.flightOut ?? "—"}</b><small className="muted">{cur.airlineName}</small></div>{cur.reg && <span className="fb-reg ltr">{cur.reg}</span>}</header>
          <p className="fb-sl"><span className="fb-st">{cur.label}</span> {cur.sub ?? ""} <em>{minsLine(cur)}</em></p>
          <div className="fb-path ltr"><span><b>{cur.origin ?? "—"}</b><small>{L.from}</small></span><i /><span className="me"><b>{cur.station ?? "—"}</b><small>{cur.ground !== null ? fill(L.groundMin, { n: cur.ground }) : L.station}</small></span><i /><span><b>{cur.dest ?? "—"}</b><small>{L.to}</small></span></div>
          <dl className="fb-times ltr">
            <div><dt>STA</dt><dd>{hm(cur.sta)}</dd></div><div><dt>{L.eta}</dt><dd>{hm(cur.eta)}</dd></div><div><dt>ATA</dt><dd>{hm(cur.ata)}</dd></div>
            <div><dt>STD</dt><dd>{hm(cur.std)}</dd></div><div><dt>ATD</dt><dd>{hm(cur.atd)}</dd></div>
          </dl>
          {cur.stepsTotal > 0 && <div><div className="bar" aria-hidden="true"><i style={{ width: `${(cur.stepsDone / cur.stepsTotal) * 100}%` }} /></div><small className="muted">{fill(L.steps, { a: cur.stepsDone, b: cur.stepsTotal })}{cur.critical > 0 ? ` · ${fill(L.crit, { n: cur.critical })}` : ""}</small></div>}
          <div className="fb-acts">
            <Link className="btn gold" href={cur.href}>{L.open}</Link>
            <Link className="btn" href={`${cur.href}&view=handling`}>{L.vHandling}</Link>
            <Link className="btn" href={`${cur.href}&view=messages`}>{L.vMessages}</Link>
            <Link className="btn" href={`${cur.href}&view=delay`}>{L.vDelay}</Link>
          </div>
        </aside></>}
    </div>
  );
}
