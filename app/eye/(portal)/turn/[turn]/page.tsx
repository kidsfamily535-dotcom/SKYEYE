import Link from "next/link";
import { eyeT } from "@/lib/eye/i18n-server";
import { eyeStations, eyeTurnState, isUuid, myWorkspaces, pickWorkspace } from "@/lib/eye/api";
import { toOtpState } from "@/lib/eye/turn";
import EyeStand from "@/components/eye/EyeStand";

export const dynamic = "force-dynamic";

export default async function EyeTurnPage({ params, searchParams }: { params: Promise<{ turn: string }>; searchParams: Promise<{ ws?: string; d?: string }> }) {
  const [{ turn }, sp] = await Promise.all([params, searchParams]);
  const { t, lang } = await eyeT();
  const list = await myWorkspaces();
  const ws = list.ok ? pickWorkspace(list.data, sp.ws) : null;
  if (!ws) return null;
  const back = list.ok && list.data.length > 1 ? `/eye?ws=${ws.workspace_id}` : "/eye";
  const bad = (
    <div className="eye-page">
      <Link className="eye-back" href={back}>{t("back")}</Link>
      <p className="eye-note err" role="alert">{t("turnErr")}</p>
    </div>
  );
  if (!isUuid(turn)) return bad;

  const [res, stRes] = await Promise.all([eyeTurnState(ws.workspace_id, turn, lang), eyeStations(ws.workspace_id)]);
  const otp = res.ok ? toOtpState(res.data) : null;
  if (!otp || otp.status !== "ok") return bad;

  const tn = otp.snapshot.turn;
  const stationId = res.ok ? String(res.data.station_id ?? "") : "";
  const stationName = stRes.ok ? stRes.data.find((s) => s.station_id === stationId)?.name ?? null : null;
  const label = [tn.flight_in, tn.flight_out].filter(Boolean).join(" / ") || "—";
  const dir = sp.d === "arrival" || sp.d === "departure" ? sp.d : null;

  return (
    <div className="eye-page">
      <div className="eye-bar">
        <Link className="eye-back" href={back}>{t("back")}</Link>
        <span className="eye-pill">{t("viewOnly")}</span>
        {dir && <span className="eye-pill dir">{t(dir)}</span>}
        {stationName && <span className="muted eye-st">{t("station")}: {stationName}</span>}
      </div>
      <EyeStand otp={otp} flightLabel={label} registration={tn.registration} />
    </div>
  );
}
