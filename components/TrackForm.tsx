"use client";
import { useState, useTransition } from "react";
import { trackAircraft, type TrackResult } from "@/app/track/actions";

const EXAMPLES = ["SU-GEK", "SU-GDM", "SU-RBA"];

export default function TrackForm() {
  const [reg, setReg] = useState("");
  const [res, setRes] = useState<TrackResult | null>(null);
  const [pending, start] = useTransition();

  const go = (value: string) => {
    const v = value.trim();
    if (!v || pending) return;
    start(async () => setRes(await trackAircraft(v)));
  };

  return (
    <>
      <div className="dock-row">
        <input className="ltr" dir="ltr" value={reg} maxLength={10} placeholder="SU-GEK" aria-label="رقم تسجيل الطائرة"
          style={{ flex: 1, minHeight: 46, borderRadius: 12, border: "1px solid var(--line)", background: "rgba(255,255,255,.06)", color: "var(--ink)", padding: "0 14px" }}
          onChange={(e) => setReg(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); go(reg); } }} />
        <button type="button" className="btn gold" disabled={pending || !reg.trim()} onClick={() => go(reg)}>{pending ? "…" : "فين الطيارة؟"}</button>
      </div>
      <div className="sugg" aria-label="أمثلة">
        {EXAMPLES.map((x) => <button key={x} type="button" className="btn ghost sm ltr" disabled={pending} onClick={() => { setReg(x); go(x); }}>{x}</button>)}
      </div>

      {res && !res.ok && <p role="alert" className="err">{res.message}</p>}

      {res && res.ok && (
        <section className="card" aria-live="polite" style={{ marginTop: 16 }}>
          <h2 className="ltr" dir="ltr">{res.aircraft?.registration ?? res.input}{res.aircraft?.type ? ` · ${res.aircraft.type}` : ""}{res.aircraft?.callsign ? ` · ${res.aircraft.callsign}` : ""}</h2>

          {res.status === "found" && res.aircraft && (
            <>
              <p><span className={`tag ${res.aircraft.on_ground ? "info" : "ok"}`}>{res.aircraft.on_ground ? "على الأرض" : "في الجو"}</span>{res.stale && <span className="tag warn" style={{ marginInlineStart: 8 }}>الموقع قديم</span>}{res.aircraft.emergency && <span className="tag late" style={{ marginInlineStart: 8 }}>تبث حالة طوارئ: {res.aircraft.emergency}</span>}</p>
              {res.aircraft.lat != null && res.aircraft.lon != null && <p>الموقع: <bdi className="ltr">{res.aircraft.lat.toFixed(3)}, {res.aircraft.lon.toFixed(3)}</bdi></p>}
              {res.aircraft.nearest_reference_airport && (res.aircraft.on_ground ? res.aircraft.nearest_reference_airport.dist_nm <= 10 : res.aircraft.nearest_reference_airport.dist_nm <= 150) && (
                <p>{res.aircraft.on_ground ? "قرب مطار" : "أقرب مطار مرجعي:"} <bdi>{res.aircraft.nearest_reference_airport.name} (<span className="ltr">{res.aircraft.nearest_reference_airport.icao}</span>)</bdi> · <bdi className="ltr">{res.aircraft.nearest_reference_airport.dist_nm} nm</bdi></p>
              )}
              {!res.aircraft.on_ground && <p>الارتفاع: <bdi className="ltr">{res.aircraft.altitude_ft != null ? `${res.aircraft.altitude_ft} ft` : "غير مبلّغ"}</bdi></p>}
              <p>السرعة: <bdi className="ltr">{res.aircraft.ground_speed_kt != null ? `${res.aircraft.ground_speed_kt} kt` : "غير مبلّغ"}</bdi> · الاتجاه: <bdi className="ltr">{res.aircraft.track_deg != null ? `${res.aircraft.track_deg}°` : "غير مبلّغ"}</bdi></p>
              <p className="muted">آخر تحديث للموقع: {res.aircraft.last_position_age_s != null ? `قبل ${res.aircraft.last_position_age_s} ثانية` : "غير معروف"}</p>
              {res.aircraft.map_url && <p><a className="btn ghost sm" href={res.aircraft.map_url} target="_blank" rel="noopener noreferrer">افتح الخريطة</a></p>}
            </>
          )}
          {res.status === "not_seen" && <p>غير ظاهرة حالياً على شبكات ADS-B. ممكن الترانسبوندر مقفول، أو على الأرض خارج التغطية، أو مش بتطير. ده مش معناه إنها مش موجودة.</p>}
          {res.status === "source_unavailable" && <p>تعذّر الوصول لمصادر التتبع حالياً. جرّب بعد شوية.</p>}

          {res.ours.length > 0 && <p>في جدول شركتنا: <bdi className="ltr">{res.ours.join("، ")}</bdi></p>}
          <small className="muted">المصدر: ADS-B مجتمعي{res.source ? ` (${res.source})` : ""}. التغطية مش كاملة وليس مصدراً تشغيلياً رسمياً، للمعلومة فقط.</small>
        </section>
      )}
    </>
  );
}
