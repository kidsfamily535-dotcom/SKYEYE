"use client";
import Link from "next/link";
import { useState } from "react";

export type RadarTurn = { id: string; reg: string | null; arrNo: string | null; depNo: string | null; arrAt: string | null; depAt: string | null; inBlock: string | null; station: string | null; phase: "ground" | "approach" | "later" };

// Airline ground radar: the control-tower scope (rings + sweep arm) read the Flightradar way (one yellow aircraft per flight, a label, click to open).
// Rings mean STATE, not distance. Nothing here is a real position: it only uses what the flight list already says.
const PL = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";
const RING = [{ r: 70, c: "#FFC107" }, { r: 118, c: "#E8A33D" }, { r: 166, c: "#8FB8FF" }, { r: 214, c: "#B5B5B5" }];
const T = {
  ar: { title: "رادار الأرض", rings: ["على الأرض", "بعد الموعد المخطط", "في الاقتراب", "لاحقًا اليوم"], note: "الحلقات تعبّر عن حالة الرحلة وليست مسافات أو مواقع حقيقية.", ok: "على الموعد", late: "بعد الموعد المخطط", onStand: "على الوقفة من", dep: "الإقلاع المخطط", arr: "الوصول المخطط", open: "افتح الوقفة", none: "مفيش رحلات على الأرض أو قريبة دلوقتي.", utc: "UTC" },
  en: { title: "Ground radar", rings: ["On the ground", "Past planned time", "Approaching", "Later today"], note: "Rings show flight state, not distance or real position.", ok: "On time", late: "Past planned time", onStand: "On stand since", dep: "Planned departure", arr: "Planned arrival", open: "Open stand", none: "No flights on the ground or close right now.", utc: "UTC" },
};
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

export default function EyeRadar({ turns, ws, lang, nowMs }: { turns: RadarTurn[]; ws: string; lang: "ar" | "en"; nowMs: number }) {
  const x = T[lang];
  const [sel, setSel] = useState<string | null>(turns[0]?.id ?? null);
  const cur = turns.find((t) => t.id === sel) ?? turns[0] ?? null;
  const isLate = (t: RadarTurn) => (t.phase === "ground" ? !!t.depAt && nowMs > Date.parse(t.depAt) : t.phase === "approach" ? !!t.arrAt && nowMs > Date.parse(t.arrAt) : false);
  const ringOf = (t: RadarTurn) => (t.phase === "ground" ? (isLate(t) ? 1 : 0) : t.phase === "approach" ? 2 : 3);
  const label = (t: RadarTurn) => t.depNo ?? t.arrNo ?? "—";
  const groups = RING.map((_, i) => turns.filter((t) => ringOf(t) === i));
  return (
    <section className="eye-rd" aria-label={x.title}>
      <div className="eye-rd-map">
        <svg viewBox="0 0 520 520" role="img" aria-label={x.title} style={{ direction: "ltr" }}>
          <defs><linearGradient id="eye-sw" x1="0" x2="1"><stop offset="0" stopColor="#FFC107" stopOpacity="0" /><stop offset="1" stopColor="#FFC107" stopOpacity=".28" /></linearGradient></defs>
          <circle cx={260} cy={260} r={246} fill="#1F1F1F" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1={260} y1={260} x2={260 + 246 * Math.cos((i * Math.PI) / 4)} y2={260 + 246 * Math.sin((i * Math.PI) / 4)} stroke="rgba(255,255,255,.06)" />)}
          <g className="eye-rd-sweep"><path d="M260 260L260 14A246 246 0 0 1 417 71Z" fill="url(#eye-sw)" /></g>
          {RING.map((g, i) => (
            <g key={i}>
              <circle cx={260} cy={260} r={g.r} fill="none" stroke={g.c} strokeWidth={1} strokeDasharray={i === 2 ? "6 5" : undefined} opacity={groups[i].length ? 0.6 : 0.25} />
              <text x={260} y={260 - g.r - 3} textAnchor="middle" fill={g.c} fontSize={9} opacity={0.85}>{x.rings[i]} · {groups[i].length}</text>
            </g>
          ))}
          {groups.map((list, ri) => list.slice(0, 10).map((t, i) => {
            const a = ((360 / Math.min(list.length, 10)) * i + ri * 41 + 20) * (Math.PI / 180), px = 260 + RING[ri].r * Math.cos(a), py = 260 + RING[ri].r * Math.sin(a), rot = (a * 180) / Math.PI + 90;
            const on = sel === t.id;
            return (
              <g key={t.id} transform={`translate(${px},${py})`} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={label(t)} onClick={() => setSel(t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSel(t.id); }}>
                {on && <circle r={20} fill="none" stroke="#fff" strokeWidth={1.4} />}
                <g transform={`rotate(${rot}) scale(.42)`}><path d={PL} fill={ri === 3 ? "none" : RING[ri].c} stroke={ri === 3 ? RING[ri].c : "#000"} strokeOpacity={ri === 3 ? 1 : 0.55} strokeWidth={3} strokeDasharray={ri === 2 || ri === 3 ? "8 6" : undefined} /></g>
                <g transform="translate(14,-6)"><rect y={-10} width={on ? 64 : 58} height={17} rx={3} fill="rgba(20,20,20,.9)" /><text x={on ? 32 : 29} y={2} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={700}>{label(t)}</text></g>
              </g>
            );
          }))}
          <circle cx={260} cy={260} r={5} fill="#F2F2F2" />
        </svg>
        <p className="eye-rd-note">{x.note}</p>
      </div>
      <aside className="eye-rd-panel">
        {turns.length === 0 && <p className="eye-rd-card muted">{x.none}</p>}
        {groups.map((l, i) => l.length > 0 && (
          <div key={i}>
            <h3 className="eye-rd-h"><i style={{ background: RING[i].c }} />{x.rings[i]} <small>{l.length}</small></h3>
            {l.map((t) => (
              <button key={t.id} type="button" className={`eye-rd-card${sel === t.id ? " on" : ""}`} onClick={() => setSel(t.id)}>
                <span className="eye-rd-r1"><b className="ltr">{label(t)}</b>{t.reg && <span className="eye-rd-pill ltr">{t.reg}</span>}{t.phase !== "later" && <span className={`eye-rd-pill ${isLate(t) ? "w" : "k"}`}>{isLate(t) ? x.late : x.ok}</span>}</span>
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
