import type { RadarCounts } from "@/lib/data";

const rows: [keyof RadarCounts, string][] = [
  ["onGround", "على الأرض"], ["inbound", "وصول متوقع"], ["delayed", "متأخرة"], ["awaitingMsg", "بانتظار رسالة"],
];

export default function Radar({ counts }: { counts: RadarCounts }) {
  return (
    <div className="radar">
      <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
        <circle cx="60" cy="60" r="56" className="rg" /><circle cx="60" cy="60" r="36" className="rg" /><circle cx="60" cy="60" r="14" className="rg" />
        <path d="M60 4V116M4 60H116" className="rg" />
        <g className="sweep"><path d="M60 60L60 4A56 56 0 0 1 100 20Z" fill="url(#sw)" /><line x1="60" y1="60" x2="60" y2="4" className="rl" /></g>
        <defs><linearGradient id="sw" x1="0" x2="1"><stop offset="0" stopColor="#E3B964" stopOpacity="0" /><stop offset="1" stopColor="#E3B964" stopOpacity=".35" /></linearGradient></defs>
      </svg>
      <dl>
        {rows.map(([k, label]) => (<div key={k}><dt>{label}</dt><dd className="ltr">{counts[k] ?? "—"}</dd></div>))}
      </dl>
    </div>
  );
}
