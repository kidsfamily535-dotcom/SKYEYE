import Link from "next/link";
import type { EyeFlight } from "@/lib/eye/types";
import type { EyeKey } from "@/lib/eye/i18n";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const dm = (iso: string) => new Date(iso).toISOString().slice(5, 10).split("-").reverse().join("/");

/** One flight, one row. Arrival and departure of the same turnaround are two rows that open the same stand scene. */
export default function FlightRow({ f, ws, t, stationName }: { f: EyeFlight; ws: string; t: (k: EyeKey) => string; stationName: string | null }) {
  const arr = f.direction === "arrival";
  return (
    <li>
      <Link className={`eye-row ${f.direction}`} href={`/eye/turn/${f.turn_id}?ws=${ws}&d=${f.direction}`}>
        <span className="eye-dir"><i aria-hidden="true">{arr ? "↓" : "↑"}</i>{t(arr ? "arrival" : "departure")}</span>
        <span className="eye-fn ltr">{f.flight_number}</span>
        <span className="eye-time ltr">{hm(f.scheduled_at)} <small>{t("utc")} · {dm(f.scheduled_at)}</small></span>
        <span className="eye-meta">
          {f.registration && <span className="ltr">{f.registration}</span>}
          {f.linked_flight && <span>{t(arr ? "leavesAs" : "cameAs")} <b className="ltr">{f.linked_flight}</b></span>}
          {stationName && <span>{stationName}</span>}
          {f.in_block_at && <span className="eye-onstand">{t("onStand")} <b className="ltr">{hm(f.in_block_at)}</b></span>}
        </span>
      </Link>
    </li>
  );
}
