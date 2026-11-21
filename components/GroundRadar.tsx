"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { BoardRow } from "@/lib/flight-board";

// "Ground radar" flights screen: flights on the ground as numbered cards, the selected one opens its stand panel (OtpGantt, passed in from the server).
const hm = (v: number | null) => (v === null ? "—" : new Date(v).toISOString().slice(11, 16));
const tone = (r: BoardRow) => (r.tone === "late" ? "late" : r.tone === "warn" ? "warn" : "idle");

export default function GroundRadar({ rows, selId, stand, lang, listHref, importHref }: { rows: BoardRow[]; selId: string | null; stand: ReactNode; lang: "ar" | "en"; listHref: string; importHref: string }) {
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  const needle = q.trim().toLowerCase();
  const hit = (r: BoardRow) => !needle || [r.flightIn, r.flightOut, r.reg, r.origin, r.dest, r.airlineCode].some((x) => (x ?? "").toLowerCase().includes(needle));
  const ground = useMemo(() => rows.filter((r) => r.code === "onGround" && hit(r)).sort((a, b) => (a.dep ?? 9e15) - (b.dep ?? 9e15)), [rows, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const soon = useMemo(() => rows.filter((r) => r.code === "soon" && hit(r)).sort((a, b) => (a.arr ?? 9e15) - (b.arr ?? 9e15)), [rows, needle]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = (r: BoardRow, i: number | null) => (
    <li key={r.id}>
      <Link href={`/flights?sel=${r.id}`} className={`rd-card ${selId === r.id ? "sel" : ""}`} aria-current={selId === r.id ? "true" : undefined}>
        <span className="rd-c1">
          <b className="ltr">{i !== null ? `${i}. ` : ""}{r.flightIn ?? "—"}{r.flightOut ? ` / ${r.flightOut}` : ""}</b>
          {r.reg && <em className="ltr">{r.reg}</em>}
          {r.tone !== "ok" && r.tone !== "info" && <em className={`chip ${tone(r)}`}>{r.label}</em>}
          <span className={`rd-time ltr ${tone(r)}`}>{hm(r.dep)}</span>
        </span>
        <span className="rd-c2 ltr">{ar ? `وصول ${hm(r.arr)} — إقلاع مخطط ${hm(r.dep)}` : `Arr ${hm(r.arr)} — planned dep ${hm(r.dep)}`}</span>
      </Link>
    </li>
  );

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
        <section className="rd-panel">
          <h2 className="rd-h">{ar ? "الرحلات على الأرض" : "Flights on the ground"}<span className="rd-live">{ar ? "مباشر" : "LIVE"}</span></h2>
          {ground.length === 0 ? <p className="rd-empty">{ar ? "لا طائرات على الأرض حاليًا." : "No aircraft on the ground right now."}</p> : <ul className="rd-list">{ground.map((r, i) => card(r, i + 1))}</ul>}
          {soon.length > 0 && <><h3 className="rd-sub">{ar ? "قادمة خلال ساعة" : "Arriving within the hour"}</h3><ul className="rd-list">{soon.map((r) => card(r, null))}</ul></>}
        </section>
        <section className="rd-panel rd-wide">
          {selId && <Link className="rd-open" href={`/flights?id=${selId}`}>{ar ? "ملف الرحلة ›" : "Flight file ›"}</Link>}
          {stand}
        </section>
      </div>
    </div>
  );
}
