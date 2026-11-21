import Shell from "@/components/Shell";
import GroundMap, { type Radar } from "@/components/GroundMap";
import { getCommandData } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";
import "../flights/radar.css";
import "./ground-map.css";

export const dynamic = "force-dynamic";

// Ground radar for the handling company: stand map, live services, delays and notifications.
// Everything comes from the DB function otp_radar (membership-checked); nothing is computed or invented here.
export default async function OtpRadarPage() {
  const [data, { lang }] = await Promise.all([getCommandData(), getT()]);
  const { data: radar, error } = await (await createClient()).rpc("otp_radar");
  return (
    <Shell data={data} module="flights">
      <main className="page gm-page">
        {error || !radar
          ? <p className="muted" role="alert">{lang === "ar" ? "تعذّر تحميل الرادار الأرضي." : "Could not load the ground radar."}</p>
          : <GroundMap data={radar as Radar} lang={lang} />}
      </main>
    </Shell>
  );
}
