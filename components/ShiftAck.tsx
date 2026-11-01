"use client";
import { useState, useTransition } from "react";
import { acknowledgeShift } from "@/app/handover/actions";

export default function ShiftAck({ reportId, openCount, onDone }: { reportId: string; openCount: number; onDone?: () => void }) {
  const [note, setNote] = useState("");
  const [take, setTake] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="open-form" aria-label="استلام الوردية">
      <label>ملاحظة الاستلام (اختيارية)<textarea rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
      {openCount > 0 && (
        <label className="inline"><input type="checkbox" checked={take} onChange={(e) => setTake(e.target.checked)} />أستلم الطلبات المفتوحة باسمي ({openCount})</label>
      )}
      <p className="muted">{openCount > 0 ? "إن لم تختر ذلك تبقى الطلبات عند مسؤولها الحالي ولا تتحول إلى «غير مسندة» بصمت." : "لا توجد طلبات مفتوحة في هذا التقرير."}</p>
      {msg && <p role="alert" className="err">{msg}</p>}
      <div className="row"><button type="button" className="btn gold" disabled={pending} onClick={() => start(async () => { const r = await acknowledgeShift(reportId, note, take && openCount > 0); setMsg(r.ok ? null : r.message); if (r.ok) onDone?.(); })}>أستلم الوردية</button></div>
    </div>
  );
}
