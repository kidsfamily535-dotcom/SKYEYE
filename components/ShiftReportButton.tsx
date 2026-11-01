"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ShiftAck from "@/components/ShiftAck";
import { fmtUtc } from "@/lib/format";
import type { ShiftPeek } from "@/lib/shifts";

const dash = (n: number | null) => (n === null ? "—" : String(n));

/** Header button: a dot while a shift report waits to be acknowledged; opens a side panel with the summary and the explicit acknowledgement. */
export default function ShiftReportButton({ peek }: { peek: ShiftPeek }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const r = peek.report;

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };

  return (
    <>
      <button ref={trigger} type="button" className="iconbtn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
        aria-label={peek.pending > 0 ? "تقرير الوردية، يوجد تقرير بانتظار الاستلام" : "تقرير الوردية"}>
        <span aria-hidden="true">📋</span><span className="lbl">تقرير الوردية</span>{peek.pending > 0 && <i className="pip" aria-hidden="true" />}
      </button>

      {open && (
        <>
          <div className="drawer-back" onClick={close} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="تقرير الوردية">
            <div className="row between">
              <h2>تقرير الوردية</h2>
              <button ref={closeBtn} type="button" className="btn ghost sm" onClick={close}>إغلاق</button>
            </div>

            {!r && (
              <>
                <p className="muted">لا يوجد تقرير بانتظار الاستلام الآن. يجهّز الوكيل التقرير قبل انتهاء كل وردية بـ 15 دقيقة.</p>
                <div className="row"><Link className="btn ghost" href="/handover" onClick={() => setOpen(false)}>كل التقارير والورديات</Link></div>
              </>
            )}

            {r && (
              <>
                <p><b><bdi>{r.shiftName}</bdi></b> <em className="tag warn">بانتظار الاستلام</em></p>
                <p className="muted"><span className="ltr">{fmtUtc(r.start)}</span> ← <span className="ltr">{fmtUtc(r.end)}</span> · ولّده الوكيل <span className="ltr">{fmtUtc(r.generatedAt)}</span></p>
                {peek.pending > 1 && <p className="muted">يوجد {peek.pending} تقارير بانتظار الاستلام؛ هذا أحدثها، والباقي في صفحة التقارير.</p>}
                <ul className="stats">
                  <li><b className="ltr">{r.counts.requests}</b>طلب مفتوح</li>
                  <li><b className="ltr">{r.counts.alerts}</b>تنبيه قائم</li>
                  <li><b className="ltr">{r.counts.questions}</b>سؤال بلا إجابة</li>
                  <li><b className="ltr">{r.counts.flights}</b>طائرة على الأرض</li>
                </ul>
                <dl className="facts">
                  <div><dt>إيميلات جديدة</dt><dd className="ltr">{dash(r.counts.emailsNew)}</dd></div>
                  <div><dt>منها عاجلة</dt><dd className="ltr">{dash(r.counts.emailsUrgent)}</dd></div>
                  <div><dt>مسودات بانتظار المراجعة</dt><dd className="ltr">{dash(r.counts.drafts)}</dd></div>
                </dl>
                <p className="muted">هذه لقطة لحظة التوليد. التفاصيل الكاملة والحال الحالي لكل طلب في صفحة التقرير.</p>
                <div className="row"><Link className="btn ghost" href={`/handover?id=${r.id}`} onClick={() => setOpen(false)}>افتح التقرير كاملاً</Link></div>

                <h3>الاستلام</h3>
                {peek.canAck
                  ? <ShiftAck reportId={r.id} openCount={r.counts.requests} onDone={() => { setOpen(false); router.refresh(); }} />
                  : <p className="muted">{peek.canWrite ? "حسابك غير مربوط بملف موظف، فلا يمكنك الاستلام. اطلب من المسؤول إضافتك في الموظفين." : "صلاحية المشاهدة لا تسمح بالاستلام."}</p>}
              </>
            )}
          </aside>
        </>
      )}
    </>
  );
}
