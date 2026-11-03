import Link from "next/link";
import Logo from "@/components/Logo";
import { cardStatus } from "@/lib/flight-status";
import type { FlightRow } from "@/lib/flights";
import { getT } from "@/lib/lang";
import { fwd } from "@/lib/i18n";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");

export default async function FlightCard({ r, href, hot }: { r: FlightRow; href: string; hot?: boolean }) {
  const { t, lang } = await getT();
  const s = cardStatus(r, t);
  const arr = r.ata ?? r.eta ?? r.sta; const arrNote = r.ata ? t("fl.card.actual") : r.eta ? t("fl.card.expected") : t("fl.card.scheduled");
  const dep = r.atd ?? r.std; const depNote = r.atd ? t("fl.card.actual") : t("fl.card.scheduled");
  return (
    <li className={`fcard ${hot ? "hot" : ""}`}>
      <Link href={href} className="fcard-link" aria-label={t("fl.card.open", { flight: r.flightIn ?? r.flightOut ?? "" })}>
        <span className={`fstatus ${s.tone}`}><b>{s.label}</b>{s.sub && <small>{s.sub}</small>}
          {r.attn && (r.attn.alerts > 0 || r.attn.due) && <span className="amarks">
            {/* علامة واحدة للتنبيهات بأعلى مستوى، حتى لو عليها أكتر من تنبيه */}
            {r.attn.alerts > 0 && r.attn.level && <span className={`amark ${r.attn.level}`} role="img" aria-label={t("fl.attn.alertsAria", { n: r.attn.alerts, level: r.attn.level })}>{r.attn.level}{r.attn.alerts > 1 ? <small>×{r.attn.alerts}</small> : null}</span>}
            {/* مهمة ED/NI: أيقونة صغيرة منفصلة وهادية، مش تنبيه */}
            {r.attn.due && <span className={`amark task ${r.attn.due.isDue ? "now" : ""}`} role="img" aria-label={t(r.attn.due.isDue ? "fl.attn.dueAria" : "fl.attn.waitAria", { type: r.attn.due.type.replace(/^MVT-/, "") })}>{r.attn.due.type.replace(/^MVT-/, "")}</span>}
          </span>}
        </span>
        <span className="fid">
          {r.airline ? <Logo url={r.airline.logoUrl} code={r.airline.code} name={r.airline.name} size="md" /> : <b className="logo ltr">—</b>}
          <span><b className="ltr">{r.flightIn ?? "—"}</b><small className="muted"><bdi>{r.airline?.name ?? r.airline?.code ?? ""}</bdi>{r.flightOut ? <> · <span className="ltr">{r.flightOut}</span></> : null}</small></span>
        </span>
        <span className="froute ltr"><b>{r.origin ?? "—"}</b><i aria-hidden="true">→</i><b>{r.station ?? "—"}</b><i aria-hidden="true">→</i><b>{r.destination ?? "—"}</b><small className="muted">{r.registration ?? ""}</small></span>
        <span className="ftimes ltr"><span><small>STA · {arrNote}</small><b>{hm(arr)}</b></span><span><small>STD · {depNote}</small><b>{hm(dep)}</b></span></span>
        <span className="fgo" aria-hidden="true">{fwd(lang)}</span>
      </Link>
    </li>
  );
}
