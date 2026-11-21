import Link from "next/link";
import type { RadarCounts } from "@/lib/data";

// Control-tower scope for the home page. Instrument style, not icons: bezel ticks, range rings (one per category, labelled with its count),
// targets drawn as a dot + heading vector + two history dots, and a sweep with a fading trail. Max 12 targets per ring; more is shown as "+N".
// Numbers come straight from the cockpit counts; null shows a dashed empty ring and "—".
const RINGS: { k: keyof RadarCounts; r: number; c: string; href: string }[] = [
  { k: "onGround", r: 40, c: "#FFC107", href: "/flights" },
  { k: "inbound", r: 68, c: "#8FB8FF", href: "/flights" },
  { k: "delayed", r: 96, c: "#FF766C", href: "/flights" },
  { k: "awaitingMsg", r: 124, c: "#3FB58A", href: "/flights" },
];
const C = 150, R = 140, MAX = 12;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, d: number) => [C + r * Math.sin(rad(d)), C - r * Math.cos(rad(d))] as const; // 0 deg = top, clockwise
const f = (n: number) => n.toFixed(1);

export default function CommandScope({ counts, labels, ar }: { counts: RadarCounts; labels: Record<keyof RadarCounts, string>; ar: boolean }) {
  const aria = RINGS.map((x) => `${labels[x.k]}: ${counts[x.k] ?? "\u2014"}`).join("\u060c ");
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const trail = Array.from({ length: 16 }, (_, i) => i); // 16 wedges of 3 deg, fading
  return (
    <div className="cr-scope-wrap">
      <svg className="cr-scope" viewBox="0 0 300 300" role="img" aria-label={aria}>
        <circle cx={C} cy={C} r={R + 8} fill="#161616" stroke="#3A3A3A" />
        <circle cx={C} cy={C} r={R} fill="#1B1B1B" stroke="#2F2F2F" />
        {ticks.map((d) => { const long = d % 30 === 0; const [x1, y1] = pt(R, d); const [x2, y2] = pt(R + (long ? 8 : 4), d); return <line key={d} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke={long ? "#8A8A8A" : "#555"} strokeWidth={long ? 1.2 : 0.8} />; })}
        {[0, 90, 180, 270].map((d) => { const [x, y] = pt(R + 17, d); return <text key={d} x={f(x)} y={f(y + 3)} textAnchor="middle" fontSize="8" fill="#8A8A8A" fontFamily="ui-monospace,Menlo,monospace">{String(d).padStart(3, "0")}</text>; })}
        {[0, 45, 90, 135].map((d) => { const [x1, y1] = pt(R, d); const [x2, y2] = pt(R, d + 180); return <line key={d} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke="rgba(255,255,255,.07)" />; })}
        <g className="cr-sweep">
          {trail.map((i) => { const a0 = -i * 3, a1 = -(i + 1) * 3; const [x0, y0] = pt(R, a0); const [x1, y1] = pt(R, a1); return <path key={i} d={`M${C} ${C}L${f(x0)} ${f(y0)}A${R} ${R} 0 0 0 ${f(x1)} ${f(y1)}Z`} fill="#FFC107" opacity={f(0.2 * (1 - i / 16))} />; })}
          <line x1={C} y1={C} x2={C} y2={C - R} stroke="#FFC107" strokeWidth="1.2" opacity=".85" />
        </g>
        {RINGS.map((x, ri) => {
          const total = counts[x.k]; const n = Math.min(total ?? 0, MAX);
          return (
            <g key={x.k}>
              <circle cx={C} cy={C} r={x.r} fill="none" stroke={x.c} strokeWidth="1" strokeDasharray={total == null ? "2 4" : undefined} opacity={total == null ? 0.3 : 0.38} />
              {Array.from({ length: n }, (_, i) => {
                const a = (360 / n) * i + ri * 31 + (i % 2) * 5;
                const [px, py] = pt(x.r, a); const [vx, vy] = pt(x.r + 0, a + 9 * (ri % 2 ? -1 : 1));
                const [h1x, h1y] = pt(x.r, a - 6 * (ri % 2 ? -1 : 1)); const [h2x, h2y] = pt(x.r, a - 12 * (ri % 2 ? -1 : 1));
                return (
                  <g key={i}>
                    <circle cx={f(h2x)} cy={f(h2y)} r="1.1" fill={x.c} opacity=".25" /><circle cx={f(h1x)} cy={f(h1y)} r="1.6" fill={x.c} opacity=".5" />
                    <line x1={f(px)} y1={f(py)} x2={f(vx)} y2={f(vy)} stroke={x.c} strokeWidth="1.2" opacity=".9" />
                    <circle cx={f(px)} cy={f(py)} r="6" fill={x.c} opacity=".14" /><circle cx={f(px)} cy={f(py)} r="2.8" fill={x.c} />
                  </g>);
              })}
              <g transform={`translate(${C} ${C - x.r})`}>
                <rect x="-15" y="-7" width="30" height="14" rx="3" fill="#111" stroke={x.c} strokeOpacity=".6" />
                <text y="3.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={x.c} fontFamily="ui-monospace,Menlo,monospace">{total == null ? "\u2014" : total}</text>
              </g>
            </g>);
        })}
        <circle cx={C} cy={C} r="2.2" fill="#F2F2F2" /><line x1={C - 7} y1={C} x2={C + 7} y2={C} stroke="#777" /><line x1={C} y1={C - 7} x2={C} y2={C + 7} stroke="#777" />
      </svg>
      <ul className="cr-legend">
        {RINGS.map((x) => (
          <li key={x.k}><Link href={x.href}><i style={{ background: x.c }} /><span>{labels[x.k]}</span><b className="ltr">{counts[x.k] ?? "\u2014"}</b></Link></li>))}
        <li className="cr-note">{ar ? "كل نقطة = رحلة محسوبة (حتى 12 لكل حلقة). الرقم على الحلقة هو العدد الكامل." : "One target = one counted flight (up to 12 per ring). The number on the ring is the full count."}</li>
      </ul>
    </div>
  );
}
