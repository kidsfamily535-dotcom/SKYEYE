import Link from "next/link";
import ToneIcon from "./ToneIcon";
import { getT } from "@/lib/lang";
import { labelOf } from "@/lib/i18n";
import { fmtUtc } from "@/lib/format";
import { LIB_KINDS, type LibData, type LibKind } from "@/lib/library";
import { addLibraryNote, setLibraryStatus } from "@/app/library-actions";

type Props = { data: LibData; q: string; kind: LibKind | null; open: { no: string; kind: LibKind } | null };

const href = (q: string, k: LibKind | null, o?: { no: string; kind: string }) => {
  const p = new URLSearchParams();
  if (q) p.set("q", q); if (k) p.set("k", k);
  if (o) { p.set("f", o.no); p.set("fk", o.kind); }
  const s = p.toString();
  return `/${s ? `?${s}` : ""}#library`;
};

/** The company library on the command page: search any file by its number, open it, read everything filed in it. */
export default async function LibraryPanel({ data, q, kind, open }: Props) {
  const { t, lang } = await getT();
  const kindName = (k: string) => labelOf(lang, "lib.kind", k);
  return (
    <section id="library" className="hm-lib" aria-label={t("lib.title")}>
      <div className="lib-head">
        <div><h2>{t("lib.title")}</h2><p>{t("lib.sub")}</p></div>
        <Link href="/files" className="lib-docs"><span className="lib-docs-ico"><ToneIcon name="files" size={22} /></span><span><b>{t("lib.docs")}</b><small>{t("lib.docs.sub")}</small></span></Link>
      </div>

      {!data && <p className="hm-empty">{t("home.noMembership")}</p>}
      {data && (<>
        <form method="get" action="/" className="lib-search" role="search">
          <input name="q" defaultValue={q} className="ltr" placeholder={t("lib.ph")} aria-label={t("lib.search")} autoComplete="off" />
          {kind && <input type="hidden" name="k" value={kind} />}
          <button className="btn gold">{t("lib.search")}</button>
        </form>
        <div className="lib-kinds" role="group" aria-label={t("lib.kinds")}>
          <Link href={href(q, null)} className={`chip ${!kind ? "on" : ""}`} aria-current={!kind ? "true" : undefined}>{t("lib.kind.all")}</Link>
          {LIB_KINDS.map((k) => <Link key={k} href={href(q, k)} className={`chip ${kind === k ? "on" : ""}`} aria-current={kind === k ? "true" : undefined}>{kindName(k)}</Link>)}
        </div>

        <div className={`lib-grid ${open ? "has-detail" : ""}`}>
          <ul className="lib-rows">
            {data.rows.length === 0 && <li className="hm-empty">{t("lib.empty")}</li>}
            {data.rows.map((r) => {
              const on = open && open.no.toUpperCase() === r.fileNo.toUpperCase() && open.kind === r.kind;
              return (
                <li key={`${r.kind}:${r.fileNo}`}>
                  <Link href={href(q, kind, { no: r.fileNo, kind: r.kind })} className={`lib-row ${on ? "on" : ""}`} aria-current={on ? "true" : undefined}>
                    <span className="lib-no ltr"><bdi>{r.fileNo}</bdi></span>
                    <span className="lib-meta"><span className="lib-kind">{kindName(r.kind)}</span>{r.status === "closed" && <span className="lib-closed">{t("lib.closed")}</span>}
                      <small><bdi>{r.title}</bdi></small></span>
                    <span className="lib-n"><b className="ltr">{r.entries}</b><small>{t("lib.entries")}</small></span>
                  </Link>
                </li>);
            })}
          </ul>

          {open && data.detail === "missing" && <div className="lib-detail"><p className="hm-empty">{t("lib.missing")}</p></div>}
          {open && data.detail && data.detail !== "missing" && (() => {
            const d = data.detail;
            return (
              <article className="lib-detail" aria-label={d.fileNo}>
                <header>
                  <Link href={href(q, kind)} className="lib-close" aria-label={t("lib.back")}>✕</Link>
                  <h3 className="ltr"><bdi>{d.fileNo}</bdi></h3>
                  <p><span className="lib-kind">{kindName(d.kind)}</span> · {d.status === "closed" ? t("lib.closed") : t("lib.open")} · <span className="ltr">{fmtUtc(d.openedAt)}</span></p>
                  {d.title && <p className="lib-title"><bdi>{d.title}</bdi></p>}
                  {d.previousNos.length > 0 && <p className="lib-prev">{t("lib.prev")}: <span className="ltr">{d.previousNos.join(" · ")}</span></p>}
                </header>
                <div className="lib-counts">{Object.entries(d.counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => <span key={k} className="chip"><b className="ltr">{n}</b>&nbsp;{labelOf(lang, "lib.type", k)}</span>)}</div>

                {d.canWrite && (
                  <div className="lib-write">
                    <form action={addLibraryNote}>
                      <input type="hidden" name="file" value={d.fileId} />
                      <label className="sr" htmlFor="lib-note">{t("lib.note")}</label>
                      <textarea id="lib-note" name="text" rows={2} maxLength={2000} placeholder={t("lib.note.ph")} required />
                      <button className="btn">{t("lib.note.add")}</button>
                    </form>
                    <form action={setLibraryStatus}>
                      <input type="hidden" name="file" value={d.fileId} />
                      <input type="hidden" name="to" value={d.status === "closed" ? "open" : "closed"} />
                      <button className="btn ghost">{d.status === "closed" ? t("lib.reopen") : t("lib.close")}</button>
                    </form>
                  </div>)}

                <ol className="lib-entries">
                  {d.entries.length === 0 && <li className="muted">{t("lib.noEntries")}</li>}
                  {d.entries.map((e) => (
                    <li key={e.id}>
                      <time className="ltr" dateTime={e.at}>{fmtUtc(e.at)}</time>
                      <span className="lib-etype">{labelOf(lang, "lib.type", e.type)}</span>
                      <span className="lib-esum"><bdi>{e.summary ?? ""}</bdi>{e.by !== "system" && <small> · {t(`lib.by.${e.by}` as never)}</small>}</span>
                    </li>))}
                </ol>
              </article>);
          })()}
        </div>
      </>)}
    </section>
  );
}
