"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerFile, approveVersion, rejectVersion } from "@/app/files/actions";
import type { LibFile, FileChange } from "@/lib/files";
import { labelOf } from "@/lib/i18n";
import { useT } from "@/components/I18n";

const MAX_FILES = 10, MAX_BYTES = 20 * 1024 * 1024;
const BLOCKED = new Set(["exe", "bat", "cmd", "com", "scr", "msi", "js", "vbs", "ps1", "sh", "dll", "jar", "apk", "app", "dmg"]);
const extOf = (n: string) => (n.includes(".") ? n.split(".").pop() ?? "" : "").toLowerCase();
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const when = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";
/** Storage keys stay ASCII; the real name is kept in the database and shown to the employee. */
const safeKey = (n: string) => { const e = extOf(n); const base = n.slice(0, Math.max(0, n.length - (e ? e.length + 1 : 0))).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "file"; return e ? `${base}.${e}` : base; };
async function sha256(f: File): Promise<string | undefined> {
  try { const h = new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer())); return [...h].map((x) => x.toString(16).padStart(2, "0")).join(""); } catch { return undefined; }
}
const show = (v: unknown) => (v == null || v === "" ? "∅" : String(v).slice(0, 60));

export default function FilesLibrary({ companyId, canWrite, active, drafts }: { companyId: string; canWrite: boolean; active: LibFile[]; drafts: LibFile[] }) {
  const { t: tr, lang } = useT();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const nameOf = (id: string | null) => active.find((f) => f.id === id)?.name ?? null;

  const upload = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    if (!picked.length) return;
    if (picked.length > MAX_FILES) { setMsg({ ok: false, text: tr("files.tooMany", { n: MAX_FILES }) }); return; }
    const bad = picked.find((f) => BLOCKED.has(extOf(f.name)));
    if (bad) { setMsg({ ok: false, text: tr("files.e.typeNamed", { name: bad.name }) }); return; }
    const big = picked.find((f) => f.size > MAX_BYTES);
    if (big) { setMsg({ ok: false, text: tr("files.tooBig", { name: big.name }) }); return; }
    setMsg(null);
    start(async () => {
      setBusy(true);
      const sb = createClient(); let done = 0;
      for (const f of picked) {
        const path = `${companyId}/library/${crypto.randomUUID()}/${safeKey(f.name)}`;
        const { error } = await sb.storage.from("company-files").upload(path, f, { contentType: f.type || undefined, upsert: false });
        if (error) { setMsg({ ok: false, text: tr("files.e.upload", { name: f.name }) }); break; }
        const r = await registerFile(companyId, { path, name: f.name, size: f.size, type: f.type, sha256: await sha256(f) });
        if (!r.ok) { setMsg({ ok: false, text: `${f.name}: ${r.message}` }); await sb.storage.from("company-files").remove([path]).catch(() => {}); break; }
        done++;
      }
      setBusy(false);
      if (done === picked.length) setMsg({ ok: true, text: tr("files.uploaded", { n: done }) });
      router.refresh();
    });
  };

  const approve = (id: string) => start(async () => { const r = await approveVersion(id); setMsg(r.ok ? { ok: true, text: tr("files.approved") } : { ok: false, text: r.message }); router.refresh(); });
  const reject = (id: string) => start(async () => { const r = await rejectVersion(id, why); if (r.ok) { setOpen(null); setWhy(""); setMsg({ ok: true, text: tr("files.rejected") }); } else setMsg({ ok: false, text: r.message }); router.refresh(); });

  const line = (c: FileChange): string => {
    const op = String(c.op ?? "");
    if (op === "set_cell") return `${c.sheet ? `${show(c.sheet)}!` : ""}${c.cell ? show(c.cell) : `R${show(c.row)}C${show(c.col)}`}: ${show(c.old)} → ${show(c.new)}`;
    if (op === "replace_text") return `"${show(c.find)}" → "${show(c.replace)}" (×${show(c.count)})`;
    if (op === "add_row" || op === "delete_row") return `${labelOf(lang, "files.op", op)}${c.sheet ? ` · ${show(c.sheet)}` : ""} · ${show(c.row)}`;
    return labelOf(lang, "files.op", op);
  };

  const Meta = ({ f }: { f: LibFile }) => (
    <div className="fl-meta">
      <span className="ltr">v{f.version}</span><span className="ltr">{kb(f.size)}</span>
      <span>{labelOf(lang, "files.src", f.source)}</span><span>{labelOf(lang, "files.by", f.createdByKind)}</span><span className="ltr">{when(f.createdAt)}</span>
    </div>
  );

  return (
    <div className="stack">
      {canWrite && (
        <section className="card" aria-label={tr("files.upload")}>
          <div className="fl-hd">
            <h2 className="grow">{tr("files.upload")}</h2>
            <input ref={input} id="fl-file" type="file" multiple className="sr" onChange={(e) => upload(e.currentTarget.files)} />
            <label htmlFor="fl-file" className={`btn gold${pending || busy ? " disabled" : ""}`} aria-disabled={pending || busy}>{pending || busy ? tr("files.uploading") : tr("files.pick")}</label>
          </div>
          <small className="muted">{tr("files.hint", { n: MAX_FILES })}</small>
        </section>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "ok" : "err"}>{msg.text}</p>}

      {drafts.length > 0 && (
        <section className="card" aria-label={tr("files.drafts")}>
          <h2>{tr("files.drafts")} <span className="tag warn ltr">{drafts.length}</span></h2>
          <small className="muted">{tr("files.draftNote")}</small>
          <ul className="fl-list">
            {drafts.map((f) => (
              <li key={f.id} className="fl-item draft">
                <i className="dot warn" />
                <div className="fl-body">
                  <b className="fl-name"><bdi className="ltr">{f.name}</bdi></b>
                  <Meta f={f} />
                  {nameOf(f.parentId) && <small className="muted">{tr("files.basedOn")} <bdi className="ltr">{nameOf(f.parentId)}</bdi></small>}
                  {f.reason && <small className="muted">{tr("files.reason")}: {f.reason}</small>}
                  {f.changes.length > 0 && (
                    <ul className="fl-changes" aria-label={tr("files.changes")}>
                      {f.changes.slice(0, 8).map((c, i) => <li key={i}><bdi className="ltr">{line(c)}</bdi></li>)}
                      {f.changesTotal > Math.min(8, f.changes.length) && <li className="muted">{tr("files.moreChanges", { n: f.changesTotal - Math.min(8, f.changes.length) })}</li>}
                    </ul>
                  )}
                  {open === f.id && (
                    <div className="stack">
                      <label htmlFor={`why-${f.id}`}>{tr("files.rejectReason")}</label>
                      <textarea id={`why-${f.id}`} rows={2} maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={tr("files.rejectPh")} />
                    </div>
                  )}
                </div>
                <div className="fl-actions">
                  {f.url && <a className="btn sm" href={f.url} target="_blank" rel="noopener noreferrer">{tr("files.download")}</a>}
                  {canWrite && open !== f.id && <>
                    <button type="button" className="btn gold sm" disabled={pending} onClick={() => approve(f.id)}>{tr("files.approve")}</button>
                    <button type="button" className="btn danger sm" disabled={pending} onClick={() => { setOpen(f.id); setWhy(""); }}>{tr("files.reject")}</button>
                  </>}
                  {canWrite && open === f.id && <>
                    <button type="button" className="btn danger solid sm" disabled={pending || why.trim().length < 3} onClick={() => reject(f.id)}>{tr("files.confirmReject")}</button>
                    <button type="button" className="btn sm" disabled={pending} onClick={() => setOpen(null)}>{tr("files.cancel")}</button>
                  </>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-label={tr("files.library")}>
        <h2>{tr("files.library")} <span className="tag info ltr">{active.length}</span></h2>
        {active.length === 0 ? <p className="muted">{tr("files.empty")}</p> : (
          <ul className="fl-list">
            {active.map((f) => (
              <li key={f.id} className="fl-item">
                <i className="dot ok" />
                <div className="fl-body"><b className="fl-name"><bdi className="ltr">{f.name}</bdi></b><Meta f={f} /></div>
                <div className="fl-actions">{f.url && <a className="btn sm" href={f.url} target="_blank" rel="noopener noreferrer">{tr("files.download")}</a>}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
