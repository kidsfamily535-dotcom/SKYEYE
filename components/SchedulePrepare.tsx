"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { requestSchedulePrepare, refreshSchedulePrepares, type SchedulePrepareItem } from "@/app/flights/import/schedule-actions";
import { labelOf } from "@/lib/i18n";
import { useT } from "@/components/I18n";

const MAX_BYTES = 20 * 1024 * 1024;
const ACTIVE = new Set(["requested", "processing"]);
/** Storage keys stay ASCII; the real name is shown to the employee and kept in the database. */
const safeKey = (n: string) => { const base = n.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "schedule"; return `${base}.pdf`; };
const tone = (s: string) => (s === "ready_for_review" ? "ok" : s === "failed" ? "late" : "info");

export default function SchedulePrepare({ companyId, initial }: { companyId: string; initial: SchedulePrepareItem[] }) {
  const { t: tr, lang } = useT();
  const [items, setItems] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const waiting = items.some((i) => ACTIVE.has(i.status));

  // While the agent is still working, check again every 10 seconds; stop as soon as nothing is waiting.
  useEffect(() => {
    if (!waiting) return;
    const h = setInterval(async () => { try { setItems(await refreshSchedulePrepares()); } catch { /* try again on the next tick */ } }, 10000);
    return () => clearInterval(h);
  }, [waiting]);

  const onFile = (list: FileList | null) => {
    const f = list?.[0];
    if (input.current) input.current.value = "";
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { setMsg({ ok: false, text: tr("sp.e.pdfOnly") }); return; }
    if (f.size > MAX_BYTES) { setMsg({ ok: false, text: tr("sp.e.tooBig", { name: f.name }) }); return; }
    setMsg(null);
    start(async () => {
      setBusy(true);
      const path = `${companyId}/schedules/${crypto.randomUUID()}/${safeKey(f.name)}`;
      const { error } = await createClient().storage.from("company-files").upload(path, f, { contentType: "application/pdf", upsert: false });
      if (error) { setBusy(false); setMsg({ ok: false, text: tr("sp.e.uploadFailed", { name: f.name }) }); return; }
      const r = await requestSchedulePrepare(companyId, { path, name: f.name, size: f.size, type: "application/pdf" });
      setBusy(false);
      if (!r.ok) { setMsg({ ok: false, text: r.message }); return; }
      setMsg({ ok: true, text: r.already ? tr("sp.already") : tr("sp.requested") });
      setItems(await refreshSchedulePrepares());
    });
  };

  return (
    <div className="stack">
      <p className="muted">{tr("sp.intro")}</p>
      <div className="row">
        <input ref={input} id="sp-file" type="file" accept=".pdf,application/pdf" className="sr" onChange={(e) => onFile(e.currentTarget.files)} />
        <label htmlFor="sp-file" className={`btn gold${pending || busy ? " disabled" : ""}`} aria-disabled={pending || busy}>{pending || busy ? tr("sp.sending") : tr("sp.pick")}</label>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "ok" : "err"}>{msg.text}</p>}

      {items.length > 0 && (
        <ul className="list" aria-label={tr("sp.list")}>
          {items.map((i) => {
            const s = i.summary, c = s?.counts;
            return (
              <li key={i.id}>
                <i className={`dot ${tone(i.status)}`} />
                <span>
                  <b className="ltr">{i.fileName}</b> <span className={`tag ${tone(i.status)}`}>{labelOf(lang, "sp.status", i.status)}</span>
                  {ACTIVE.has(i.status) && <small className="muted">{tr("sp.working")}</small>}
                  {i.status === "failed" && <small className="err">{tr("sp.failed")}</small>}
                  {s && i.status === "ready_for_review" && (
                    <>
                      <small className="muted">
                        {s.schedule && <><span className="ltr">{s.schedule}</span> · </>}
                        {s.period && <><span className="ltr">{s.period[0]} → {s.period[1]}</span> · </>}
                        {tr("sp.turnarounds")} <span className="ltr">{c?.turnaround ?? 0}</span> · {tr("sp.waitNext")} <span className="ltr">{c?.wait_next_schedule ?? 0}</span> · {tr("sp.waitPrev")} <span className="ltr">{c?.wait_previous_schedule ?? 0}</span>
                        {(s.flagged_turnarounds ?? 0) > 0 && <> · {tr("sp.flagged")} <span className="ltr">{s.flagged_turnarounds}</span></>}
                      </small>
                      {(s.warnings ?? []).map((w) => { const code = w.split(":")[0].trim(); return <small key={w} className="err">{labelOf(lang, "sp.warn", code) === code ? w : labelOf(lang, "sp.warn", code)}</small>; })}
                      {i.excelUrl && <a className="btn sm" href={i.excelUrl} download>{tr("sp.download")}</a>}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {items.some((i) => i.status === "ready_for_review") && <small className="muted">{tr("sp.reviewNote")}</small>}
    </div>
  );
}
