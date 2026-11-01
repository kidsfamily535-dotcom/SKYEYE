"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { linkEmailToRequest, openRequestFromEmail } from "@/app/requests/actions";

type Opt = { id: string; title: string; flightRef: string | null; stageLabelAr: string };

export default function OpenRequestForm({ companyId, triageId, messageId, linked, linkable }: { companyId: string; triageId: string; messageId: string; linked: Opt[]; linkable: Opt[] }) {
  const [mode, setMode] = useState<"none" | "new" | "link">("none");
  const [f, setF] = useState({ title: "", flightRef: "", flightDate: "", dueAt: "", urgent: false });
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = (r: { ok: boolean; message?: string }) => { setMsg(r.ok ? null : r.message ?? "حدث خطأ"); if (r.ok) setMode("none"); };

  return (
    <div>
      {linked.length > 0 && <ul className="list">{linked.map((l) => <li key={l.id}><span><Link href={`/requests?id=${l.id}`}><bdi>{l.title}</bdi></Link><small className="muted">{l.stageLabelAr}</small></span></li>)}</ul>}
      {linked.length === 0 && <p className="muted">هذا الإيميل غير مربوط بأي ملف طلب.</p>}
      {msg && <p role="alert" className="err">{msg}</p>}
      {mode === "none" && <div className="row"><button type="button" className="btn" onClick={() => setMode("new")}>افتح ملف طلب (تصريح)</button>{linkable.length > 0 && <button type="button" className="btn ghost" onClick={() => setMode("link")}>اربطه بملف موجود</button>}</div>}
      {mode === "new" && (
        <div className="open-form">
          <label>عنوان الطلب<input value={f.title} maxLength={160} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>رقم الرحلة<input className="ltr" value={f.flightRef} onChange={(e) => setF({ ...f, flightRef: e.target.value })} /></label>
          <label>تاريخ الرحلة<input type="date" className="ltr" value={f.flightDate} onChange={(e) => setF({ ...f, flightDate: e.target.value })} /></label>
          <label>موعد الطلب (بتوقيت UTC)<input type="datetime-local" className="ltr" value={f.dueAt} onChange={(e) => setF({ ...f, dueAt: e.target.value })} /></label>
          <p className="muted">اتركه فارغاً إن لم يتحدد؛ بدونه لا يُولَّد تنبيه موعد. ملف واحد لكل تصريح.</p>
          <label className="inline"><input type="checkbox" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} />طلب عاجل</label>
          <div className="row"><button type="button" className="btn gold" disabled={pending || !f.title.trim()} onClick={() => start(async () => done(await openRequestFromEmail({ triageId, ...f })))}>فتح الملف</button><button type="button" className="btn ghost" onClick={() => setMode("none")}>رجوع</button></div>
        </div>
      )}
      {mode === "link" && (
        <div className="open-form">
          <label>الملف<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="">اختر ملفاً</option>{linkable.map((o) => <option key={o.id} value={o.id}>{o.title} · {o.stageLabelAr}</option>)}</select></label>
          <div className="row"><button type="button" className="btn gold" disabled={pending || !target} onClick={() => start(async () => done(await linkEmailToRequest(companyId, target, messageId)))}>اربط</button><button type="button" className="btn ghost" onClick={() => setMode("none")}>رجوع</button></div>
        </div>
      )}
    </div>
  );
}
