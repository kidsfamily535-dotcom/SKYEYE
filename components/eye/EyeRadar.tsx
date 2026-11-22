"use client";
import Link from "next/link";
import { useState } from "react";

export type RadarTurn = { id: string; reg: string | null; arrNo: string | null; depNo: string | null; arrAt: string | null; depAt: string | null; inBlock: string | null; station: string | null; phase: "ground" | "approach" };

const PL = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";
const T = {
  ar: { title: "رادار الأرض", ground: "على الأرض", approach: "في الاقتراب", note: "رسم تخطيطي للرصيف: أماكن الطائرات ليست مواقف حقيقية.", ok: "على الموعد", late: "بعد الموعد المخطط", onStand: "على الوقفة من", dep: "الإقلاع المخطط", arr: "الوصول المخطط", open: "افتح الوقفة", none: "مفيش طيارات على الأرض أو في الاقتراب دلوقتي.", term: "المبنى", lane: "الاقتراب", utc: "UTC" },
  en: { title: "Ground radar", ground: "On the ground", approach: "Approaching", note: "Schematic apron: aircraft positions are not real stands.", ok: "On time", late: "Past planned time", onStand: "On stand since", dep: "Planned departure", arr: "Planned arrival", open: "Open stand", none: "No aircraft on the ground or approaching right now.", term: "Terminal", lane: "Approach", utc: "UTC" },
};
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

export default function EyeRadar({ turns, ws, lang, nowMs }: { turns: RadarTurn[]; ws: string; lang: "ar" | "en"; nowMs: number }) {
  const x = T[lang];
  const ground = turns.filter((t) => t.phase === "ground");
  const appr = turns.filter((t) => t.phase === "approach");
  const [sel, setSel] = useState<string | null>(turns[0]?.id ?? null);
  const cur = turns.find((t) => t.id === sel) ?? turns[0] ?? null;
  const n = Math.max(4, ground.length, appr.length), W = 40 + n * 150;
  const late = (t: RadarTurn) => (t.phase === "ground" ? !!t.depAt && nowMs > Date.parse(t.depAt) : !!t.arrAt && nowMs > Date.parse(t.arrAt));
  const label = (t: RadarTurn) => t.depNo ?? t.arrNo ?? "—";
  const plane = (t: RadarTurn, cx: number, cy: number, s: number, dashed: boolean) => (
    <g key={t.id} transform={`translate(${cx},${cy})`} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={label(t)} onClick={() => setSel(t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSel(t.id); }}>
      {sel === t.id && <circle r={52 * s} fill="none" stroke="#FFC107" strokeWidth={1.6} />}
      <g transform={`scale(${s})`}><path d={PL} fill={dashed ? "none" : late(t) ? "#E8A33D" : "#FFC107"} stroke={dashed ? "#FFC107" : "#000"} strokeOpacity={dashed ? 1 : 0.6} strokeDasharray={dashed ? "5 4" : undefined} strokeWidth={1.6} /></g>
      <g transform={`translate(${44 * s},${-8})`}><rect y={-11} width={72} height={20} rx={3} fill="rgba(20,20,20,.88)" /><text x={36} y={4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{label(t)}</text></g>
    </g>
  );
  return (
    <section className="eye-rd" aria-label={x.title}>
      <div className="eye-rd-map">
        <svg viewBox={`0 0 ${W} 330`} role="img" aria-label={x.title} style={{ direction: "ltr" }}>
          <rect x={0} y={0} width={W} height={330} fill="#46443F" />
          <rect x={10} y={8} width={W - 20} height={262} rx={6} fill="#55534E" />
          <rect x={20} y={12} width={W - 40} height={34} rx={4} fill="#34343A" />
          <text x={W / 2} y={34} textAnchor="middle" fill="#fff" fontSize={11}>{x.term}</text>
          {Array.from({ length: n }).map((_, i) => <g key={i}><rect x={50 + i * 150} y={62} width={130} height={170} rx={4} fill="none" stroke="rgba(255,255,255,.3)" strokeDasharray="4 4" /><line x1={115 + i * 150} y1={46} x2={115 + i * 150} y2={80} stroke="#34343A" strokeWidth={4} /></g>)}
          <rect x={0} y={282} width={W} height={14} fill="#34343A" />
          <line x1={0} y1={289} x2={W} y2={289} stroke="#E5B800" strokeWidth={1.2} strokeDasharray="10 8" />
          <text x={W - 16} y={320} textAnchor="end" fill="#fff" fontSize={10} opacity={0.8}>{x.lane}</text>
          {ground.map((t, i) => plane(t, 115 + i * 150, 150, 0.9, false))}
          {appr.map((t, i) => plane(t, 115 + i * 150, 289, 0.55, true))}
        </svg>
        <p className="eye-rd-note">{x.note}</p>
      </div>
      <aside className="eye-rd-panel">
        {turns.length === 0 && <p className="eye-rd-card muted">{x.none}</p>}
        {[{ k: x.ground, l: ground }, { k: x.approach, l: appr }].filter((g) => g.l.length > 0).map((g) => (
          <div key={g.k}>
            <h3 className="eye-rd-h">{g.k} <small>{g.l.length}</small></h3>
            {g.l.map((t) => (
              <button key={t.id} type="button" className={`eye-rd-card${sel === t.id ? " on" : ""}`} onClick={() => setSel(t.id)}>
                <span className="eye-rd-r1"><b className="ltr">{label(t)}</b>{t.reg && <span className="eye-rd-pill ltr">{t.reg}</span>}<span className={`eye-rd-pill ${late(t) ? "w" : "k"}`}>{late(t) ? x.late : x.ok}</span></span>
                <span className="eye-rd-s2 ltr">{t.phase === "ground" ? `${x.dep} ${hm(t.depAt)} ${x.utc}` : `${x.arr} ${hm(t.arrAt)} ${x.utc}`}</span>
              </button>
            ))}
          </div>
        ))}
        {cur && (
          <div className="eye-rd-card eye-rd-sel">
            <span className="eye-rd-r1"><b className="ltr">{cur.arrNo ?? "—"} / {cur.depNo ?? "—"}</b>{cur.reg && <span className="eye-rd-pill ltr">{cur.reg}</span>}</span>
            {cur.station && <span className="eye-rd-s2">{cur.station}</span>}
            {cur.inBlock && <span className="eye-rd-s2 ltr">{x.onStand} {hm(cur.inBlock)} {x.utc}</span>}
            {cur.depAt && <span className="eye-rd-s2 ltr">{x.dep} {hm(cur.depAt)} {x.utc}</span>}
            <Link className="eye-rd-open" href={`/eye/turn/${cur.id}?ws=${ws}&d=${cur.arrNo ? "arrival" : "departure"}`}>{x.open}</Link>
          </div>
        )}
      </aside>
    </section>
  );
}
