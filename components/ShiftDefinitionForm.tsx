"use client";
import { useState, useTransition } from "react";
import { saveShiftDefinition } from "@/app/handover/actions";

export default function ShiftDefinitionForm({ companyId }: { companyId: string }) {
  const [f, setF] = useState({ name: "", start: "", hours: "12" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="open-form">
      <label>اسم الوردية<input value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>بداية الوردية (بتوقيت UTC)<input className="ltr" placeholder="09:00" inputMode="numeric" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
      <label>مدتها بالساعات<input className="ltr" inputMode="decimal" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
      <p className="muted">إن كان الاسم موجوداً من قبل يُعدَّل بدل أن يتكرر. التقرير يُولَّد قبل نهاية الوردية بـ 15 دقيقة.</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "muted" : "err"}>{msg.text}</p>}
      <div className="row"><button type="button" className="btn gold" disabled={pending || !f.name.trim() || !f.start.trim()} onClick={() => start(async () => {
        const r = await saveShiftDefinition(companyId, f.name, f.start, Number(f.hours), true);
        setMsg(r.ok ? { ok: true, text: "تم حفظ الوردية." } : { ok: false, text: r.message });
        if (r.ok) setF({ name: "", start: "", hours: "12" });
      })}>حفظ الوردية</button></div>
    </div>
  );
}
