import Link from "next/link";
import Logo from "@/components/Logo";
import { cardStatus } from "@/lib/flight-status";
import type { FlightRow } from "@/lib/flights";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

export default function FlightCard({ r, href, hot }: { r: FlightRow; href: string; hot?: boolean }) {
  const s = cardStatus(r);
  const arr = r.ata ?? r.eta ?? r.sta; const arrNote = r.ata ? "فعلي" : r.eta ? "متوقع" : "مجدول";
  const dep = r.atd ?? r.std; const depNote = r.atd ? "فعلي" : "مجدول";
  return (
    <li className={`fcard ${hot ? "hot" : ""}`}>
      <Link href={href} className="fcard-link" aria-label={`فتح ملف الرحلة ${r.flightIn ?? r.flightOut ?? ""}`}>
        <span className={`fstatus ${s.tone}`}><b>{s.label}</b>{s.sub && <small>{s.sub}</small>}</span>
        <span className="fid">
          {r.airline ? <Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} size="md" /> : <b className="logo ltr">—</b>}
          <span><b className="ltr">{r.flightIn ?? "—"}</b><small className="muted"><bdi>{r.airline?.name ?? r.airline?.code ?? ""}</bdi>{r.flightOut ? <> · <span className="ltr">{r.flightOut}</span></> : null}</small></span>
        </span>
        <span className="froute ltr"><b>{r.origin ?? "—"}</b><i aria-hidden="true">→</i><b>{r.station ?? "—"}</b><i aria-hidden="true">→</i><b>{r.destination ?? "—"}</b><small className="muted">{r.registration ?? ""}</small></span>
        <span className="ftimes ltr"><span><small>STA · {arrNote}</small><b>{hm(arr)}</b></span><span><small>STD · {depNote}</small><b>{hm(dep)}</b></span></span>
        <span className="fgo" aria-hidden="true">‹</span>
      </Link>
    </li>
  );
}
