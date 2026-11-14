import Link from "next/link";
import type { NeededItem } from "@/lib/flights";
import type { TFn } from "@/lib/i18n";

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const short = (t: string) => t.replace(/^MVT-/, "");

/** "المطلوب الآن": what the agent wants the employee to act on for THIS flight, right now. Alerts first (by level), then message tasks (ED/NI), which are calm routine tasks, not alarms. */
export default function NowBar({ items, composeHref, t, folded = false }: { items: NeededItem[]; composeHref: (type: string) => string; t: TFn; folded?: boolean }) {
  if (items.length === 0) return null;
  /** When the flight file already shows the agent's main question at the top, everything here sits under one quiet fold. */
  if (folded) return (
    <details className="card nowbar nb-folded">
      <summary>{t("fx.d.more", { n: items.length })}</summary>
      <ul>
        {items.map((x, i) => x.kind === "alert" ? (
          <li key={x.id} className={`nb ${x.level}`}><span className={`lvl ${x.level}`}>{x.level}</span><div><b><bdi>{x.reason}</bdi></b><small className="muted">{t("fl.now.action")} <bdi>{x.action}</bdi></small></div></li>
        ) : (
          <li key={`f-${x.type}-${i}`} className="nb task"><i className={`dot ${x.isDue ? "warn" : "info"}`} aria-hidden="true" /><div><b className="ltr">{x.isDue ? t("fl.now.msgDue", { type: short(x.type) }) : t("fl.now.msgWait", { type: short(x.type), time: hm(x.dueAt) })}</b></div><Link className="btn sm" href={composeHref(x.type)}>{t("fl.now.open")}</Link></li>
        ))}
      </ul>
    </details>
  );
  return (
    <section className="card nowbar" aria-label={t("fl.now.title")}>
      <h2>{t("fl.now.title")}</h2>
      <ul>
        {items.slice(0, 1).map((x, i) => x.kind === "alert" ? (
          <li key={x.id} className={`nb ${x.level}`}>
            <span className={`lvl ${x.level}`}>{x.level}</span>
            <div><b><bdi>{x.reason}</bdi></b><small className="muted">{t("fl.now.action")} <bdi>{x.action}</bdi></small></div>
          </li>
        ) : (
          <li key={`m-${x.type}-${i}`} className="nb task">
            <i className={`dot ${x.isDue ? "warn" : "info"}`} aria-hidden="true" />
            <div>
              <b className="ltr">{x.isDue ? t("fl.now.msgDue", { type: short(x.type) }) : t("fl.now.msgWait", { type: short(x.type), time: hm(x.dueAt) })}</b>
              {x.suggested && <small className="muted">{t("fl.now.suggest", { v: x.suggested })}</small>}
            </div>
            <Link className={`btn sm ${x.isDue ? "gold" : ""}`} href={composeHref(x.type)}>{t("fl.now.open")}</Link>
          </li>
        ))}
      </ul>
      {items.length > 1 && (
        <details className="nb-more"><summary>{t("fl.now.more", { n: items.length - 1 })}</summary>
          <ul>
            {items.slice(1).map((x, i) => x.kind === "alert" ? (
              <li key={x.id} className={`nb ${x.level}`}><span className={`lvl ${x.level}`}>{x.level}</span><div><b><bdi>{x.reason}</bdi></b><small className="muted">{t("fl.now.action")} <bdi>{x.action}</bdi></small></div></li>
            ) : (
              <li key={`m2-${x.type}-${i}`} className="nb task"><i className={`dot ${x.isDue ? "warn" : "info"}`} aria-hidden="true" /><div><b className="ltr">{x.isDue ? t("fl.now.msgDue", { type: short(x.type) }) : t("fl.now.msgWait", { type: short(x.type), time: hm(x.dueAt) })}</b></div><Link className="btn sm" href={composeHref(x.type)}>{t("fl.now.open")}</Link></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
