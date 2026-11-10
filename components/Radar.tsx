import type { RadarCounts } from "@/lib/data";
import { getT } from "@/lib/lang";

/** "Orbit" radar: SKYEYE's eye in the middle, one ring per status, one orbiting aircraft per counted flight (max 6 per ring). */
const RINGS: { k: keyof RadarCounts; r: number; c: string; secs: number; back?: boolean }[] = [
  { k: "onGround", r: 21, c: "#E3B964", secs: 16 },
  { k: "inbound", r: 32, c: "#6CA6FF", secs: 24, back: true },
  { k: "delayed", r: 43, c: "#FF7266", secs: 32 },
  { k: "awaitingMsg", r: 54, c: "#3DD6A0", secs: 44, back: true },
];

export default async function Radar({ counts }: { counts: RadarCounts }) {
  const { t } = await getT();
  const label = RINGS.map((x) => `${t(`radar.${x.k}` as const)}: ${counts[x.k] ?? "—"}`).join("، ");
  return (
    <div className="orbit-wrap">
      <svg className="orbit" viewBox="0 0 140 140" role="img" aria-label={label}>
        <defs>
          <radialGradient id="ob-iris"><stop offset="0" stopColor="#FFF3C9" /><stop offset=".55" stopColor="#E3B964" /><stop offset="1" stopColor="#8A6A24" /></radialGradient>
          <radialGradient id="ob-glow"><stop offset="0" stopColor="#E3B964" stopOpacity=".38" /><stop offset="1" stopColor="#E3B964" stopOpacity="0" /></radialGradient>
          <linearGradient id="ob-scan" x1="0" x2="1"><stop offset="0" stopColor="#E3B964" stopOpacity="0" /><stop offset="1" stopColor="#E3B964" stopOpacity=".28" /></linearGradient>
        </defs>
        <circle cx="70" cy="70" r="66" fill="url(#ob-glow)" />
        <g className="ob-scan"><path d="M70 70L70 8A62 62 0 0 1 113 25Z" fill="url(#ob-scan)" /></g>
        {RINGS.map((x) => {
          const n = Math.min(counts[x.k] ?? 0, 6);
          return (
            <g key={x.k}>
              <circle cx="70" cy="70" r={x.r} className={`ob-ring ${counts[x.k] == null ? "nil" : ""}`} style={{ stroke: x.c }} />
              {n > 0 && (
                <g className={`ob-spin ${x.back ? "back" : ""} ${x.k === "delayed" ? "late" : ""}`} style={{ animationDuration: `${x.secs}s`, fill: x.c }}>
                  {Array.from({ length: n }, (_, i) => (
                    <g key={i} transform={`rotate(${(360 / n) * i} 70 70)`}>
                      <circle cx={70 + x.r} cy="70" r="5" style={{ opacity: 0.22 }} />
                      <circle cx={70 + x.r} cy="70" r="2.5" />
                    </g>))}
                </g>)}
            </g>);
        })}
        <g className="ob-eye">
          <circle cx="70" cy="70" r="11" fill="url(#ob-iris)" />
          <circle cx="70" cy="70" r="4.6" fill="#0B1530" className="ob-pupil" />
          <circle cx="72.6" cy="67.4" r="1.5" fill="#fff" opacity=".85" />
        </g>
      </svg>
      <dl className="orbit-legend">
        {RINGS.map((x) => (<div key={x.k}><dt><i style={{ background: x.c }} />{t(`radar.${x.k}` as const)}</dt><dd className="ltr">{counts[x.k] ?? "—"}</dd></div>))}
      </dl>
    </div>
  );
}
