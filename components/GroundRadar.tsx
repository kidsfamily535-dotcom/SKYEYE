"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BoardRow } from "@/lib/flight-board";

// "Ground radar" flights screen: flights on the ground as numbered cards, the selected one opens its stand panel (OtpGantt, passed in from the server).
const hm = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));
const tone = (r: BoardRow) => (r.tone === "late" ? "late" : r.tone === "warn" ? "warn" : "idle");

function Plane() {
  return (<svg viewBox="0 0 120 64" width="84" height="45"><path d="M6 32c0-2 2-4 6-5l78-3c10-1 20 3 24 8-4 5-14 9-24 8l-78-3c-4-1-6-3-6-5z" fill="currentColor" /><path d="M46 29L30 4h12l26 25zM46 35L30 60h12l26-25z" fill="currentColor" /><path d="M14 29L6 16h8l10 13zM14 35l-8 13h8l10-13z" fill="currentColor" /></svg>);
}

export default function GroundRadar({ rows, selId, stand, explicit, lang, listHref, importHref }: { rows: BoardRow[]; selId: string | null; stand: ReactNode; explicit: boolean; lang: "ar" | "en"; listHref: string; importHref: string }) {
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  const needle = q.trim().toLowerCase();
  const hit = (r: BoardRow) => !needle || [r.flightIn, r.flightOut, r.reg, r.origin, r.dest, r.airlineCode].some((x) => (x ?? "").toLowerCase().includes(needle));
  const ground = useMemo(() => rows.filter((r) => r.code === "onGround" && hit(r)).sort((a, b) => (a.dep ?? 9e15) - (b.dep ?? 9e15)), [rows, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const soon = useMemo(() => rows.filter((r) => r.code === "soon" && hit(r)).sort((a, b) => (a.arr ?? 9e15) - (b.arr ?? 9e15)), [rows, needle]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Apron strip: time runs left to right (always LTR). Each flight is an aircraft; the dashed box is its stand zone from arrival to planned departure. */
  const W0 = 45 * 60000, W1 = 180 * 60000; const t = now ?? Date.now(); const a0 = t - W0, a1 = t + W1;
  const x = (v: number) => `${(Math.max(0, Math.min(1, (v - a0) / (a1 - a0))) * 100).toFixed(2)}%`;
  const all = useMemo(() => [...ground, ...soon], [ground, soon]);
  const ticks = [-30, 0, 30, 60, 90, 120, 150].map((m) => t + m * 60000);
  const lane = (r: BoardRow) => {
    const onG = r.code === "onGround"; const arr = r.arr; const dep = r.dep;
    const late = r.tone === "late"; const warn = r.tone === "warn";
    const pos = onG ? (arr !== null ? Math.max(arr, a0) : t) : (arr !== null ? arr : t + 30 * 60000);
    return (
      <li key={r.id} className="rd-lane">
        <Link href={`/flights?sel=${r.id}`} scroll={false} className={`rd-l ${selId === r.id ? "sel" : ""}`} aria-current={selId === r.id ? "true" : undefined}>
          <span className="rd-id"><span className="rd-tag ltr"><i className={late ? "late" : warn ? "warn" : onG ? "gnd" : "inb"} />{r.flightIn ?? "—"}{r.flightOut ? ` / ${r.flightOut}` : ""}</span>{r.reg ? <em className="rd-reg ltr">{r.reg}</em> : null}</span>
          <span className="rd-track ltr">
            <u className="rd-nowline" style={{ left: x(t) }} aria-hidden="true" />
            {arr !== null && dep !== null && <span className={`rd-zone ${late ? "late" : ""}`} style={{ left: x(arr), width: `calc(${x(dep)} - ${x(arr)})`, minWidth: 14 }} aria-hidden="true" />}
            {!onG && arr !== null && <span className="rd-path" style={{ left: x(t), width: `calc(${x(arr)} - ${x(t)})` }} aria-hidden="true" />}
            <span className={`rd-plane ${onG ? "gnd" : "inb"} ${late ? "late" : ""}`} style={{ left: x(pos) }} aria-hidden="true"><Plane /></span>
            {dep !== null && <b className="rd-dep" style={{ left: x(dep) }}>{hm(dep)}</b>}
          </span>
          <span className="rd-go" aria-hidden="true">{ar ? "‹" : "›"}</span><span className="sr">{r.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="rd" dir={ar ? "rtl" : "ltr"}>
      <header className="rd-top">
        <h1>{ar ? "الرادار الأرضي" : "Ground radar"}</h1>
        <input className="rd-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث برقم الرحلة أو التسجيل" : "Search flight or registration"} aria-label={ar ? "بحث" : "Search"} />
        <span className="rd-badge ltr">UTC · {now === null ? "—" : new Date(now).toISOString().slice(11, 16)}</span>
        <Link className="rd-link" href={listHref}>{ar ? "كل الرحلات" : "All flights"}</Link>
        <Link className="rd-link" href={importHref}>{ar ? "استيراد جدول" : "Import schedule"}</Link>
      </header>
      <div className="rd-grid">
        <section className="rd-panel rd-strip">
          <h2 className="rd-h">{ar ? "رصيف الرحلات" : "Apron"}<span className="rd-live">{ar ? "مباشر" : "LIVE"}</span><small className="rd-hint">{ar ? "الطائرة الواقفة داخل المربع المتقطع = وقفتها من الوصول للإقلاع المخطط" : "Parked aircraft sit in their dashed stand zone, arrival to planned departure"}</small></h2>
          {all.length === 0 ? <p className="rd-empty">{ar ? "لا طائرات على الأرض ولا قادمة قريبًا." : "Nothing on the ground or arriving soon."}</p> : <>
            <div className="rd-axis ltr" aria-hidden="true">{ticks.map((v) => <i key={v} className={v === t ? "now" : ""} style={{ left: x(v) }}>{v === t ? (ar ? "الآن" : "NOW") : hm(v)}</i>)}</div>
            <ul className="rd-lanes">{all.map(lane)}</ul></>}
        </section>
        <section className={`rd-panel rd-wide ${explicit ? "open" : ""}`} aria-label={ar ? "وقفة الرحلة المحددة" : "Selected flight stand"}>
          {selId && <div className="rd-sh">
            <Link className="rd-file" href={`/flights?id=${selId}`}>{ar ? "ملف الرحلة وتسجيل OTP" : "Flight file & record OTP"}</Link>
            <Link className="rd-close" href="/flights" scroll={false} aria-label={ar ? "إغلاق" : "Close"}>×</Link>
          </div>}
          {stand}
        </section>
      </div>
    </div>
  );
}
