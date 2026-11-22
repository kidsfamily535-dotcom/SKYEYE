"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type RadarTurn = { id: string; reg: string | null; arrNo: string | null; depNo: string | null; arrAt: string | null; depAt: string | null; inBlock: string | null; station: string | null; phase: "ground" | "approach" | "later" };

// Airline flight map, read the Flightradar way: one aircraft icon per flight on a dark map, a label, hover for details, click opens the stand page.
// It is a SCHEMATIC airport map, not live tracking: the stand area holds aircraft that are on stand, the approach lane holds arrivals
// (further left = later), and the upper band holds flights due later today. Positions come only from what the flight list already says.
const PL = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";
const C = { ground: "#FFC107", late: "#E8A33D", approach: "#8FB8FF", later: "#B5B5B5" };
const W = 1000, H = 560, RWY_Y = 300;
const T = {
  ar: { title: "خريطة الرحلات", rwy: "الممر", lane: "مسار الاقتراب", apron: "الوقفات", laterBand: "لاحقًا اليوم", note: "رسم توضيحي للحالة وليس تتبعًا حيًا لمواقع الطيارات. اضغط على أي طيارة لفتح الوقفة.", ok: "على الموعد", late: "بعد الموعد المخطط", onStand: "على الوقفة من", dep: "الإقلاع المخطط", arr: "الوصول المخطط", hint: "اضغط لفتح الوقفة", none: "مفيش رحلات على الأرض أو قريبة دلوقتي.", utc: "UTC", st: { ground: "على الأرض", approach: "في الاقتراب", later: "لاحقًا اليوم" }, more: "رحلة زيادة" },
  en: { title: "Flights map", rwy: "RWY", lane: "Approach lane", apron: "Stands", laterBand: "Later today", note: "A schematic of flight state, not live aircraft tracking. Click any aircraft to open its stand.", ok: "On time", late: "Past planned time", onStand: "On stand since", dep: "Planned departure", arr: "Planned arrival", hint: "Click to open the stand", none: "No flights on the ground or close right now.", utc: "UTC", st: { ground: "On the ground", approach: "Approaching", later: "Later today" }, more: "more flights" },
};
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
type Placed = { t: RadarTurn; x: number; y: number; rot: number; col: string; late: boolean };

export default function EyeRadar({ turns, ws, lang, nowMs }: { turns: RadarTurn[]; ws: string; lang: "ar" | "en"; nowMs: number }) {
  const x = T[lang];
  const router = useRouter();
  const [hov, setHov] = useState<string | null>(null);
  const href = (t: RadarTurn) => `/eye/turn/${t.id}?ws=${ws}&d=${t.arrNo ? "arrival" : "departure"}`;
  const label = (t: RadarTurn) => t.depNo ?? t.arrNo ?? "—";
  const isLate = (t: RadarTurn) => (t.phase === "ground" ? !!t.depAt && nowMs > Date.parse(t.depAt) : t.phase === "approach" ? !!t.arrAt && nowMs > Date.parse(t.arrAt) : false);
  const byTime = (t: RadarTurn) => Date.parse((t.phase === "ground" ? t.depAt : t.arrAt) ?? "") || 0;

  const ground = turns.filter((t) => t.phase === "ground").sort((a, b) => byTime(a) - byTime(b));
  const approach = turns.filter((t) => t.phase === "approach").sort((a, b) => byTime(b) - byTime(a));
  const later = turns.filter((t) => t.phase === "later").sort((a, b) => byTime(a) - byTime(b));
  const SLOTS = 20;
  const placed: Placed[] = [];
  ground.slice(0, SLOTS).forEach((t, i) => { const late = isLate(t); placed.push({ t, x: 250 + (i % 10) * 62, y: i < 10 ? 440 : 508, rot: 0, col: late ? C.late : C.ground, late }); });
  let lastX = -1e9;
  approach.forEach((t) => {
    const min = ((byTime(t) - nowMs) / 60000);
    let px = min >= 0 ? 280 - (Math.min(min, 60) / 60) * 240 : 280 + (Math.min(-min, 30) / 30) * 220;
    if (px - lastX < 78) px = lastX + 78;
    lastX = px;
    const late = isLate(t);
    placed.push({ t, x: px, y: RWY_Y, rot: 90, col: late ? C.late : C.approach, late });
  });
  later.forEach((t, i) => { const h = Math.min(Math.max((byTime(t) - nowMs) / 3600000, 1), 6); placed.push({ t, x: 60 + ((h - 1) / 5) * 560 + (i % 2) * 20, y: 120 + (i % 3) * 46, rot: 90, col: C.later, late: false }); });
  const cur = placed.find((p) => p.t.id === hov)?.t ?? null;
  const groups: [keyof typeof C | "ground" | "approach" | "later", RadarTurn[], string][] = [["ground", ground, C.ground], ["approach", approach, C.approach], ["later", later, C.later]];

  return (
    <section className="eye-rd" aria-label={x.title}>
      <div className="eye-rd-map">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={x.title} style={{ direction: "ltr" }}>
          <defs><pattern id="eye-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="rgba(255,255,255,.045)" /></pattern></defs>
          <rect width={W} height={H} fill="#1b1d20" /><rect width={W} height={H} fill="url(#eye-grid)" />
          {/* runway + approach lane */}
          <line x1={0} y1={RWY_Y} x2={190} y2={RWY_Y} stroke="#8FB8FF" strokeOpacity={0.45} strokeDasharray="3 9" strokeWidth={2} />
          {[0, 15, 30, 45, 60].map((m) => <g key={m}><line x1={280 - (m / 60) * 240} y1={RWY_Y - 8} x2={280 - (m / 60) * 240} y2={RWY_Y + 8} stroke="#8FB8FF" strokeOpacity={0.5} /><text x={280 - (m / 60) * 240} y={RWY_Y + 24} textAnchor="middle" fill="#8FB8FF" opacity={0.6} fontSize={11}>{m}′</text></g>)}
          <rect x={190} y={RWY_Y - 18} width={640} height={36} rx={4} fill="#2a2c30" stroke="rgba(255,255,255,.18)" />
          <line x1={205} y1={RWY_Y} x2={815} y2={RWY_Y} stroke="rgba(255,255,255,.35)" strokeDasharray="22 16" strokeWidth={2} />
          <text x={830} y={RWY_Y - 26} fill="#a3a3a3" fontSize={12}>{x.rwy}</text>
          <text x={22} y={RWY_Y - 16} fill="#8FB8FF" opacity={0.75} fontSize={12}>{x.lane}</text>
          {/* later band */}
          <rect x={20} y={80} width={620} height={150} rx={8} fill="none" stroke="rgba(255,255,255,.12)" strokeDasharray="5 6" />
          <text x={34} y={100} fill={C.later} fontSize={12} opacity={0.85}>{x.laterBand} · {later.length}</text>
          {/* apron */}
          <rect x={210} y={395} width={640} height={150} rx={8} fill="#232529" stroke="rgba(255,193,7,.25)" />
          <text x={226} y={414} fill={C.ground} fontSize={12} opacity={0.85}>{x.apron} · {ground.length}</text>
          {Array.from({ length: SLOTS }, (_, i) => <rect key={i} x={250 + (i % 10) * 62 - 24} y={(i < 10 ? 440 : 508) - 30} width={48} height={60} rx={4} fill="none" stroke="rgba(255,255,255,.07)" />)}
          {ground.length > SLOTS && <text x={840} y={414} textAnchor="end" fill="#a3a3a3" fontSize={12}>+{ground.length - SLOTS} {x.more}</text>}
          {placed.map(({ t, x: px, y: py, rot, col }) => {
            const on = hov === t.id, dashed = t.phase !== "ground";
            return (
              <g key={t.id} transform={`translate(${px},${py})`} style={{ cursor: "pointer" }} role="link" tabIndex={0} aria-label={`${label(t)} ${t.reg ?? ""}`}
                onMouseEnter={() => setHov(t.id)} onMouseLeave={() => setHov((h) => (h === t.id ? null : h))} onFocus={() => setHov(t.id)} onBlur={() => setHov(null)}
                onClick={() => router.push(href(t))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(href(t)); } }}>
                {on && <circle r={26} fill="rgba(255,255,255,.08)" stroke="#fff" strokeWidth={1.4} />}
                <g transform={`rotate(${rot}) scale(.52)`}><path d={PL} fill={t.phase === "later" ? "none" : col} stroke={t.phase === "later" ? col : "#000"} strokeOpacity={t.phase === "later" ? 1 : 0.55} strokeWidth={3} strokeDasharray={dashed && t.phase === "later" ? "8 6" : undefined} /></g>
                <g transform={`translate(${rot === 0 ? -29 : 18},${rot === 0 ? 30 : -22})`}><rect width={58} height={17} rx={3} fill="rgba(10,10,10,.88)" stroke={on ? "#fff" : "none"} /><text x={29} y={12} textAnchor="middle" fill="#fff" fontSize={10.5} fontWeight={700}>{label(t)}</text></g>
              </g>
            );
          })}
        </svg>
        {cur && (
          <div className="eye-rd-tip" role="status">
            <span className="eye-rd-r1"><b className="ltr">{cur.arrNo ?? "—"} / {cur.depNo ?? "—"}</b>{cur.reg && <span className="eye-rd-pill ltr">{cur.reg}</span>}</span>
            <span className="eye-rd-s2">{x.st[cur.phase]}</span>
            {cur.station && <span className="eye-rd-s2">{cur.station}</span>}
            {cur.inBlock && <span className="eye-rd-s2 ltr">{x.onStand} {hm(cur.inBlock)} {x.utc}</span>}
            <span className="eye-rd-s2 ltr">{cur.phase === "ground" ? `${x.dep} ${hm(cur.depAt)} ${x.utc}` : `${x.arr} ${hm(cur.arrAt)} ${x.utc}`}</span>
            <span className="eye-rd-hint">{x.hint}</span>
          </div>
        )}
        {turns.length === 0 && <p className="eye-rd-empty">{x.none}</p>}
        <p className="eye-rd-note">{x.note}</p>
      </div>
      <aside className="eye-rd-panel">
        {groups.map(([k, l, col]) => l.length > 0 && (
          <div key={k}>
            <h3 className="eye-rd-h"><i style={{ background: col }} />{x.st[k as "ground"]} <small>{l.length}</small></h3>
            {l.map((t) => (
              <Link key={t.id} href={href(t)} className={`eye-rd-card${hov === t.id ? " on" : ""}`} onMouseEnter={() => setHov(t.id)} onMouseLeave={() => setHov(null)}>
                <span className="eye-rd-r1"><b className="ltr">{label(t)}</b>{t.reg && <span className="eye-rd-pill ltr">{t.reg}</span>}{t.phase !== "later" && <span className={`eye-rd-pill ${isLate(t) ? "w" : "k"}`}>{isLate(t) ? x.late : x.ok}</span>}</span>
                <span className="eye-rd-s2 ltr">{t.phase === "ground" ? `${x.dep} ${hm(t.depAt)} ${x.utc}` : `${x.arr} ${hm(t.arrAt)} ${x.utc}`}</span>
              </Link>
            ))}
          </div>
        ))}
      </aside>
    </section>
  );
}
