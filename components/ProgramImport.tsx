"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { previewProgram, commitProgram } from "@/app/flights/import/actions";
import type { ProgramResult } from "@/lib/program";
import { workbookToCsv } from "@/lib/sheet";

const TEMPLATE = "fn,stn,origin,dest,date,sta,std,dep,block_min,reg\nMS777/8,CAI,DXB,DXB,2026-11-01,14:00,15:30,,240,SU-GDM\n";
const ERR_AR: Record<string, string> = {
  flight_format: "رقم الرحلة غير مقروء (الشكل: MS777/8)", airline_unknown: "كود شركة الطيران غير معروف", airline_missing: "شركة الطيران غير مضافة لشركتك",
  station_unknown: "كود المحطة غير معروف", station_missing: "المحطة غير مضافة لشركتك", origin_unknown: "مطار القدوم غير معروف", dest_unknown: "مطار الوجهة غير معروف",
  date_invalid: "التاريخ غير صحيح", sta_invalid: "وقت الوصول غير صحيح", std_invalid: "وقت المغادرة غير صحيح", dep_invalid: "وقت إقلاع المطار الأصلي غير صحيح",
  block_invalid: "مدة الرحلة غير صحيحة", reg_invalid: "تسجيل الطائرة غير صحيح",
};
const WARN_AR: Record<string, string> = { exists: "موجودة من قبل وستُتجاوز", duplicate_in_paste: "مكررة في البرنامج الملصوق" };
const SOFT = new Set(["airline_missing", "station_missing"]);

export default function ProgramImport({ canAdmin }: { canAdmin: boolean }) {
  const [text, setText] = useState(""); const [res, setRes] = useState<ProgramResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null); const [addMissing, setAddMissing] = useState(false);
  const [pending, start] = useTransition();

  const reset = (t: string) => { setText(t); setRes(null); setMsg(null); };
  const onFile = async (input: HTMLInputElement) => {
    const f = input.files?.[0]; if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 4));
      const isZip = head[0] === 0x50 && head[1] === 0x4b; // xlsx / ods
      const isOle = head[0] === 0xd0 && head[1] === 0xcf; // old xls
      if (isZip || isOle) {
        const csv = workbookToCsv(buf);
        if (csv.split("\n").length < 2) { setMsg("الملف فارغ أو لا يحتوي سطر العناوين وتحته بيانات."); return; }
        reset(csv); return;
      }
      // Text files (csv/txt/tsv, or anything else that is plain text). Arabic Excel often saves CSV as Windows-1256.
      let t = new TextDecoder("utf-8").decode(buf);
      if (t.includes("\uFFFD")) t = new TextDecoder("windows-1256").decode(buf);
      if (t.includes("\u0000") || t.trim().length < 5) { setMsg("لم أستطع قراءة هذا الملف. استخدم Excel أو CSV أو الصق الجدول في الخانة."); return; }
      reset(t);
    } catch { setMsg("تعذّرت قراءة الملف. افتحه في Excel واحفظه xlsx أو CSV، أو الصق الجدول في الخانة."); }
    finally { input.value = ""; }
  };
  const preview = () => start(async () => { const r = await previewProgram(text); if (!r.ok) { setMsg(r.message); setRes(null); } else { setMsg(null); setRes(r.data); } });
  const commit = () => start(async () => { const r = await commitProgram(text, addMissing); if (!r.ok) { setMsg(r.message); return; } setRes(r.data); setMsg(null); });
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" })); a.download = "flight-program-template.csv"; a.click(); };

  const blocking = res ? res.rows.filter((r) => r.errors.some((e) => !(addMissing && SOFT.has(e)))).length : 0;
  const hasMissing = !!res && (res.missing_airlines.length > 0 || res.missing_stations.length > 0);
  const done = res?.committed ? res : null;

  return (
    <div className="stack">
      {!done && (<>
        <p className="muted">الصق الجدول من Excel (مع سطر العناوين)، أو ارفع ملفاً (Excel بأي صيغة، CSV، نص). كل سطر يعمل دوراناً كاملاً: رحلة وصول ورحلة مغادرة لنفس الطائرة. الأوقات بتوقيت <span className="ltr">UTC</span>. التاريخ بشكل <span className="ltr">2026-11-01</span> أو يوم/شهر/سنة.</p>
        <div className="row">
          <button type="button" className="btn sm" onClick={download}>تحميل القالب</button>
          <label className="btn sm" htmlFor="pf">رفع ملف</label>
          <input id="pf" type="file" className="sr" onChange={(e) => onFile(e.target)} />
        </div>
        <label htmlFor="pt">برنامج الرحلات</label>
        <textarea id="pt" className="ltr" rows={9} dir="ltr" value={text} onChange={(e) => reset(e.target.value)} placeholder={TEMPLATE} />
        {msg && <p role="alert" className="err">{msg}</p>}
        <div className="row"><button type="button" className="btn gold" disabled={pending || text.trim().length < 5} onClick={preview}>{pending && !res ? "جارٍ الفحص…" : "فحص البرنامج"}</button></div>
      </>)}

      {res && !done && (
        <div className="stack">
          <div className="chips">
            <span className="tag info">الأسطر: <span className="ltr">{res.total}</span></span>
            <span className={`tag ${blocking ? "late" : "ok"}`}>{blocking ? <>بها أخطاء: <span className="ltr">{blocking}</span></> : "سليم"}</span>
          </div>
          {hasMissing && (
            <div className="card glass">
              <b>ناقص في إعدادات شركتك</b>
              {res.missing_airlines.length > 0 && <small className="muted">شركات طيران: <span className="ltr">{res.missing_airlines.join(" ")}</span></small>}
              {res.missing_stations.length > 0 && <small className="muted">محطات: <span className="ltr">{res.missing_stations.join(" ")}</span></small>}
              {canAdmin
                ? <label className="inline"><input type="checkbox" checked={addMissing} onChange={(e) => setAddMissing(e.target.checked)} /> أضفها لشركتي عند الاعتماد</label>
                : <small className="muted">إضافتها للمدير فقط. اطلب منه إضافتها ثم افحص البرنامج من جديد.</small>}
            </div>
          )}
          <ul className="list">
            {res.rows.map((r) => {
              const bad = r.errors.filter((e) => !(addMissing && SOFT.has(e)));
              return (
                <li key={r.i}>
                  <i className={`dot ${bad.length ? "late" : r.warnings.length ? "warn" : "ok"}`} />
                  <span>
                    <b className="ltr">{r.fn || "—"}</b> <small className="muted"><span className="ltr">{r.origin}→{r.stn}→{r.dest} · {r.date} · {r.sta}→{r.std}{r.reg ? ` · ${r.reg}` : ""}</span></small>
                    {r.errors.map((e) => <small key={e} className={SOFT.has(e) && addMissing ? "muted" : "err"}>{ERR_AR[e] ?? e}{SOFT.has(e) && addMissing ? " (ستُضاف)" : ""}</small>)}
                    {r.warnings.map((w) => <small key={w} className="muted">{WARN_AR[w] ?? w}</small>)}
                  </span>
                </li>
              );
            })}
          </ul>
          {msg && <p role="alert" className="err">{msg}</p>}
          <div className="row">
            <button type="button" className="btn gold" disabled={pending || blocking > 0} onClick={commit}>{pending ? "جارٍ الحفظ…" : "اعتمد الاستيراد"}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => setRes(null)}>تعديل البرنامج</button>
          </div>
          {blocking > 0 && <small className="muted">لا يُحفظ شيء حتى تصحَّح كل الأخطاء، فالبرنامج يدخل كاملاً أو لا يدخل.</small>}
        </div>
      )}

      {done && (
        <div className="stack">
          <p className="ok">تم الاستيراد.</p>
          <div className="chips">
            <span className="tag ok">دورانات: <span className="ltr">{done.result?.rows ?? 0}</span></span>
            <span className="tag ok">رحلات جديدة: <span className="ltr">{done.result?.flights_inserted ?? 0}</span></span>
            <span className="tag info">موجودة وتم تجاوزها: <span className="ltr">{done.result?.flights_skipped_existing ?? 0}</span></span>
            {(done.airlines_added ?? 0) > 0 && <span className="tag info">شركات طيران أُضيفت: <span className="ltr">{done.airlines_added}</span></span>}
            {(done.stations_added ?? 0) > 0 && <span className="tag info">محطات أُضيفت: <span className="ltr">{done.stations_added}</span></span>}
          </div>
          <div className="row"><Link className="btn gold" href="/flights">افتح الرحلات</Link><button type="button" className="btn" onClick={() => { reset(""); }}>رفع برنامج آخر</button></div>
        </div>
      )}
    </div>
  );
}
