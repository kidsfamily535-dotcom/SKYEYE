import Link from "next/link";
import type { RadarCounts } from "@/lib/data";

// Control-tower scope for the home page: four rings (on ground, inbound, delayed, waiting on a message), one small aircraft per counted flight (max 8 per ring),
// a slow sweep arm. Numbers come straight from the cockpit counts; null shows as a dashed empty ring and "—".
const RINGS: { k: keyof RadarCounts; r: number; c: string; href: string }[] = [
  { k: "onGround", r: 36, c: "#FFC107", href: "/flights" },
  { k: "inbound", r: 62, c: "#8FB8FF", href: "/flights" },
  { k: "delayed", r: 88, c: "#FF766C", href: "/flights" },
  { k: "awaitingMsg", r: 112, c: "#3FB58A", href: "/flights" },
];
const PLANE = "M-9 0c0-1 1-2 3-2.4l22-1.2c3-.2 6 1.2 7.4 3.6-1.4 2.4-4.4 3.8-7.4 3.6l-22-1.2c-2-.4-3-1.4-3-2.4zM3 -1.4L-4 -12h4l9 10.6zM3 1.4L-4 12h4l9-10.6z";

export default function CommandScope({ counts, labels, ar }: { counts: RadarCounts; labels: Record<keyof RadarCounts, string>; ar: boolean }) {
  const aria = RINGS.map((x) => `${labels[x.k]}: ${counts[x.k] ?? "—"}`).join("، ");
  return (
    <div className="cr-scope-wrap">
      <svg className="cr-scope" viewBox="0 0 260 260" role="img" aria-label={aria}>
        <defs><linearGradient id="cr-sw" x1="0" x2="1"><stop offset="0" stopColor="#FFC107" stopOpacity="0" /><stop offset="1" stopColor="#FFC107" stopOpacity=".32" /></linearGradient></defs>
        <circle cx="130" cy="130" r="122" fill="#1F1F1F" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <line key={i} x1="130" y1="130" x2={130 + 122 * Math.cos((i * Math.PI) / 4)} y2={130 + 122 * Math.sin((i * Math.PI) / 4)} stroke="rgba(255,255,255,.06)" />)}
        <g className="cr-sweep"><path d="M130 130L130 8A122 122 0 0 1 216 44Z" fill="url(#cr-sw)" /></g>
        {RINGS.map((x, ri) => {
          const n = Math.min(counts[x.k] ?? 0, 8);
          return (
            <g key={x.k}>
              <circle cx="130" cy="130" r={x.r} fill="none" stroke={x.c} strokeWidth="1" strokeDasharray={counts[x.k] == null ? "3 4" : x.k === "inbound" ? "6 5" : undefined} opacity={counts[x.k] == null ? 0.3 : 0.55} />
              {Array.from({ length: n }, (_, i) => {
                const a = (360 / n) * i + ri * 23;
                return <g key={i} transform={`rotate(${a} 130 130) translate(${130 + x.r} 130)`}><g transform="rotate(90)"><path d={PLANE} fill={x.c} transform="scale(.9)" /></g></g>;
              })}
            </g>);
        })}
        <circle cx="130" cy="130" r="5" fill="#F2F2F2" />
      </svg>
      <ul className="cr-legend">
        {RINGS.map((x) => (
          <li key={x.k}><Link href={x.href}><i style={{ background: x.c }} /><span>{labels[x.k]}</span><b className="ltr">{counts[x.k] ?? "—"}</b></Link></li>))}
        <li className="cr-note">{ar ? "كل طائرة صغيرة = رحلة محسوبة" : "Each small aircraft = one counted flight"}</li>
      </ul>
    </div>
  );
}
