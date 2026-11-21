import Link from "next/link";
import type { RadarCounts } from "@/lib/data";

// Tower scope for the home page, drawn like a cockpit heading instrument: a brushed champagne bezel with engraved ticks and
// cardinal points, a graphite face, one range ring per category (labelled with its full count), and every counted flight drawn
// as a small aircraft flying along its ring. A fading amber sweep turns slowly; the aircraft at the centre is the tower's own position.
// Numbers come straight from the cockpit counts; null shows a dashed empty ring and "—". Max 12 aircraft per ring; the ring label holds the full count.
const RINGS: { k: keyof RadarCounts; r: number; c: string; href: string }[] = [
  { k: "onGround", r: 38, c: "#FFC107", href: "/flights" },
  { k: "inbound", r: 66, c: "#8FB8FF", href: "/flights" },
  { k: "delayed", r: 94, c: "#FF766C", href: "/flights" },
  { k: "awaitingMsg", r: 122, c: "#3FB58A", href: "/flights" },
];
const C = 170, R = 140, MAX = 12, GOLD = "#E3B964";
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, d: number) => [C + r * Math.sin(rad(d)), C - r * Math.cos(rad(d))] as const; // 0 deg = top, clockwise
const f = (n: number) => n.toFixed(1);
// Top-view aircraft, nose up, about 12 units wide.
const PLANE = "M0 -6.5L1.3 -2.2L6 1L6 2.4L1.3 1L1 4.6L2.6 5.8L2.6 7L0 6.4L-2.6 7L-2.6 5.8L-1 4.6L-1.3 1L-6 2.4L-6 1L-1.3 -2.2Z";
const CARD: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

export default function CommandScope({ counts, labels, ar }: { counts: RadarCounts; labels: Record<keyof RadarCounts, string>; ar: boolean }) {
  const aria = RINGS.map((x) => `${labels[x.k]}: ${counts[x.k] ?? "—"}`).join("، ");
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const trail = Array.from({ length: 24 }, (_, i) => i); // 24 wedges of 2 deg, fading
  return (
    <div className="cr-scope-wrap">
      <svg className="cr-scope" viewBox="0 0 340 340" role="img" aria-label={aria}>
        <defs>
          <linearGradient id="csBezel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6B5A34" /><stop offset=".28" stopColor="#E9D49A" /><stop offset=".5" stopColor="#8E7843" />
            <stop offset=".74" stopColor="#D9BE7C" /><stop offset="1" stopColor="#4D4024" />
          </linearGradient>
          <radialGradient id="csFace" cx=".5" cy=".42" r=".62">
            <stop offset="0" stopColor="#2A2A2A" /><stop offset=".7" stopColor="#151515" /><stop offset="1" stopColor="#0C0C0C" />
          </radialGradient>
          <radialGradient id="csGlass" cx=".34" cy=".2" r=".7">
            <stop offset="0" stopColor="#fff" stopOpacity=".11" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={C} cy={C} r={R + 11} fill="none" stroke="url(#csBezel)" strokeWidth="22" />
        <circle cx={C} cy={C} r={R + 22} fill="none" stroke="#000" strokeOpacity=".55" />
        <circle cx={C} cy={C} r={R + .5} fill="url(#csFace)" stroke={GOLD} strokeOpacity=".7" />

        {ticks.map((d) => {
          const long = d % 30 === 0; const [x1, y1] = pt(R + 2, d); const [x2, y2] = pt(R + (long ? 10 : 6), d);
          return <line key={d} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke="#17130A" strokeOpacity={long ? 0.95 : 0.6} strokeWidth={long ? 1.6 : 0.9} />;
        })}
        {Array.from({ length: 12 }, (_, i) => i * 30).map((d) => {
          const [x, y] = pt(R + 16.5, d);
          const card = CARD[d];
          return <text key={d} x={f(x)} y={f(y + 3.2)} textAnchor="middle" fontSize={card ? 9.5 : 7} fontWeight={card ? 800 : 600} fill="#17130A" fontFamily="ui-monospace,Menlo,monospace">{card ?? String(d / 10).padStart(2, "0")}</text>;
        })}
        {[0, 45, 90, 135].map((d) => { const [x1, y1] = pt(R, d); const [x2, y2] = pt(R, d + 180); return <line key={d} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke={GOLD} strokeOpacity={d % 90 === 0 ? 0.16 : 0.07} />; })}

        <g className="cr-sweep">
          {trail.map((i) => { const a0 = -i * 2, a1 = -(i + 1) * 2; const [x0, y0] = pt(R, a0); const [x1, y1] = pt(R, a1); return <path key={i} d={`M${C} ${C}L${f(x0)} ${f(y0)}A${R} ${R} 0 0 0 ${f(x1)} ${f(y1)}Z`} fill="#FFC107" opacity={f(0.26 * (1 - i / 24))} />; })}
          <line x1={C} y1={C} x2={C} y2={C - R} stroke="#FFD76A" strokeWidth="1.4" opacity=".9" />
        </g>

        {RINGS.map((x, ri) => {
          const total = counts[x.k]; const n = Math.min(total ?? 0, MAX); const dir = ri % 2 ? -1 : 1;
          return (
            <g key={x.k}>
              <circle cx={C} cy={C} r={x.r} fill="none" stroke={x.c} strokeWidth="1" strokeDasharray={total == null ? "2 4" : "1 3"} opacity={total == null ? 0.3 : 0.45} />
              {Array.from({ length: n }, (_, i) => {
                const a = (360 / n) * i + ri * 31 + (i % 2) * 5;
                const [px, py] = pt(x.r, a);
                const [h1x, h1y] = pt(x.r, a - 7 * dir); const [h2x, h2y] = pt(x.r, a - 14 * dir);
                return (
                  <g key={i}>
                    <circle cx={f(h2x)} cy={f(h2y)} r="1.1" fill={x.c} opacity=".22" /><circle cx={f(h1x)} cy={f(h1y)} r="1.6" fill={x.c} opacity=".45" />
                    <circle cx={f(px)} cy={f(py)} r="8" fill={x.c} opacity=".13" />
                    <path d={PLANE} transform={`translate(${f(px)} ${f(py)}) rotate(${f(a + 90 * dir)}) scale(.85)`} fill={x.c} stroke="#0C0C0C" strokeWidth=".7" strokeLinejoin="round" />
                  </g>);
              })}
              <g transform={`translate(${C} ${C - x.r})`}>
                <rect x="-16" y="-8" width="32" height="16" rx="8" fill="#0C0C0C" stroke={x.c} strokeOpacity=".75" />
                <text y="3.6" textAnchor="middle" fontSize="10" fontWeight="700" fill={x.c} fontFamily="ui-monospace,Menlo,monospace">{total == null ? "—" : total}</text>
              </g>
            </g>);
        })}

        <circle cx={C} cy={C} r="9" fill="#0C0C0C" stroke={GOLD} strokeOpacity=".6" />
        <path d={PLANE} transform={`translate(${C} ${C}) scale(.72)`} fill="#F7E7B8" />
        <circle cx={C} cy={C} r={R + .5} fill="url(#csGlass)" pointerEvents="none" />
      </svg>

      <ul className="cr-legend">
        {RINGS.map((x) => (
          <li key={x.k}><Link href={x.href} style={{ ["--c" as string]: x.c }}><i /><span>{labels[x.k]}</span><b className="ltr">{counts[x.k] ?? "—"}</b></Link></li>))}
      </ul>
      <p className="cr-note">{ar ? "كل طائرة = رحلة محسوبة (حتى 12 لكل حلقة). الرقم على الحلقة هو العدد الكامل." : "One aircraft = one counted flight (up to 12 per ring). The number on the ring is the full count."}</p>
    </div>
  );
}
