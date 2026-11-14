"use client";
import { useState, useTransition } from "react";
import { decideFlightType } from "@/app/flights/actions";
import Hint from "@/components/Hint";
import { useT } from "@/components/I18n";
import { fmtUtc } from "@/lib/format";
import type { TypeSuggestion } from "@/lib/flights";

/** SKYEYE suggests a flight type from an email and shows the evidence; nothing changes until an employee confirms. */
export default function FlightTypeSuggestions({ items, canAct }: { items: TypeSuggestion[]; canAct: boolean }) {
  const { t } = useT();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (id: string, d: "confirm" | "reject") => start(async () => { const r = await decideFlightType(id, d); setMsg(r.ok ? null : r.message); });
  if (items.length === 0) return null;
  return (
    <div className="card" id="flight-type">
      <h2>{t("fl.ft.title")}<Hint>{t("fl.ft.hint")}</Hint></h2>
      {items.map((s) => (
        <div key={s.id} className="draft">
          <p><span className={`ftype ft-${s.type}`}>{t(`fl.ft.${s.type}`)}</span> <small className="muted ltr">{fmtUtc(s.at)}</small></p>
          <small className="muted">{t("fl.ft.evidence")}</small>
          <pre className="ltr mono orig">{s.evidence}</pre>
          {canAct && (
            <div className="row">
              <span className="grow" />
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(s.id, "reject")}>{t("fl.ft.reject")}</button>
              <button type="button" className="btn gold" disabled={pending} onClick={() => run(s.id, "confirm")}>{t("fl.ft.confirm")}</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p role="alert" className="muted">{msg}</p>}
    </div>
  );
}
