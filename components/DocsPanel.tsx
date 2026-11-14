"use client";
import { useT } from "@/components/I18n";
import Hint from "@/components/Hint";
import type { CommandCenter } from "@/lib/command-center";

/** Company document types for this flight (delay letter, permit...). Shows what really exists: which types have a Word template for this station and company,
 *  and which files were already prepared. Filling a Word file from the flight data is not built yet, so the button stays off until a template exists. */
export default function DocsPanel({ cc }: { cc: CommandCenter }) {
  const { t, lang } = useT();
  const { types, prepared } = cc.documents;
  return (
    <div className="card" id="docs">
      <h2>{t("fl.doc.title")}<Hint>{t("fl.doc.hint")}</Hint></h2>
      <ul className="mv-list">
        {types.map((d) => (
          <li key={d.code} className="mv-item">
            <div className="mv-head static">
              <span className="mv-main"><b><bdi>{lang === "ar" ? d.name_ar : d.name_en}</bdi></b><small className="muted"><bdi>{d.has_template ? d.template_name ?? "" : t("fl.doc.noTemplate")}</bdi></small></span>
              <span className={`tag ${d.has_template ? "ok" : "muted"}`}>{d.has_template ? t("fl.doc.hasTemplate") : t("fl.doc.none")}</span>
              <button type="button" className="btn sm" disabled title={t("fl.doc.notBuilt")}>{t("fl.doc.make")}</button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted">{t("fl.doc.notBuilt")}</p>
      <h3 className="mv-h">{t("fl.doc.prepared")}</h3>
      {prepared.length === 0 ? <p className="muted">{t("fl.doc.preparedNone")}</p> : <ul className="mv-list">{prepared.map((p, i) => <li key={String(p.id ?? i)} className="mv-item"><div className="mv-head static"><span className="mv-main"><b><bdi>{String(p.file_name ?? p.name ?? p.code ?? "—")}</bdi></b></span></div></li>)}</ul>}
    </div>
  );
}
