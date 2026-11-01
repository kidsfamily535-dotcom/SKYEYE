import Link from "next/link";
import Logo from "@/components/Logo";
import { FLIGHT_STATUS_AR } from "@/lib/flight-labels";
import type { FlightRow } from "@/lib/flights";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

function Progress({ r }: { r: FlightRow }) {
  if (!r.stepsTotal) return <small className="muted">التقدم: —</small>;
  const pct = Math.round(((r.stepsRecorded ?? 0) / r.stepsTotal) * 100);
  return <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="مراحل المناولة المسجّلة"><i style={{ width: `${pct}%` }} /></div>;
}

/** One row per rotation: flights, route, times (UTC), status and, when the day view computed it, the next step. */
export default function FlightList({ rows, selectedId, hrefFor, showNext = false }: { rows: FlightRow[]; selectedId?: string; hrefFor: (r: FlightRow) => string; showNext?: boolean }) {
  return (
    <ul className="list flightrow">
      {rows.map((r) => (
        <li key={r.rotationId} className={r.rotationId === selectedId ? "cur" : ""}>
          <Link className="item" href={hrefFor(r)} aria-current={r.rotationId === selectedId ? "true" : undefined}>
            <b>{r.airline && <Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} />} <span className="ltr">{r.flightIn ?? "—"} ← → {r.flightOut ?? "—"}</span> <em className={`tag ${r.status === "delayed" ? "late" : r.atd || r.status === "cancelled" ? "ok" : "info"}`}>{FLIGHT_STATUS_AR[r.status] ?? r.status}</em></b>
            <small className="muted"><span className="ltr">{r.origin ?? "—"} → {r.station ?? "—"} → {r.destination ?? "—"}</span> · <span className="ltr">{r.registration ?? "—"}</span></small>
            <small className="muted">وصول <span className="ltr">{hm(r.ata ?? r.eta ?? r.sta)}</span>{r.ata ? "" : r.eta ? " (متوقع)" : " (مجدول)"} · مغادرة <span className="ltr">{hm(r.atd ?? r.std)}</span></small>
            {showNext && (
              <small className="next">{r.nextStep
                ? <>{r.nextStep.waitingForAnswer ? "الوكيل ينتظر ردك: " : "أقرب خطوة: "}<bdi>{r.nextStep.nameAr}{r.nextStep.isCritical ? " ★" : ""}</bdi>{r.nextStep.plannedAt ? <> · <span className="ltr">{hm(r.nextStep.plannedAt)}</span></> : ""}</>
                : <span className="muted">{r.atd ? "اكتملت المغادرة" : "أقرب خطوة: لا خطوة بموعد مخطط"}</span>}</small>
            )}
            <Progress r={r} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
