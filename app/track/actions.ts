"use server";
import { createClient } from "@/lib/supabase/server";

export type TrackAircraft = {
  registration: string | null; type: string | null; callsign: string | null;
  lat: number | null; lon: number | null; on_ground: boolean; altitude_ft: number | null;
  ground_speed_kt: number | null; track_deg: number | null; vertical_rate_fpm: number | null;
  emergency: string | null; last_position_age_s: number | null;
  nearest_reference_airport: { icao: string; name: string; dist_nm: number } | null; map_url: string | null;
};
export type TrackResult =
  | { ok: true; input: string; status: "found" | "not_seen" | "source_unavailable"; source: string | null; stale: boolean; aircraft: TrackAircraft | null; ours: string[] }
  | { ok: false; message: string };

/** SUGEK / su gek / SU-GEK all mean the same aircraft. Returns the spellings worth trying (max 3). */
function candidates(raw: string): string[] {
  const s = raw.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{3,8}$/.test(s)) return [];
  if (s.includes("-")) return [s];
  const out = [`${s.slice(0, 2)}-${s.slice(2)}`, `${s.slice(0, 1)}-${s.slice(1)}`, s];
  return [...new Set(out)].slice(0, 3);
}

/** Read-only look-up. Runs as the signed-in user (the track-aircraft function requires a valid login). Nothing is written or sent. */
export async function trackAircraft(raw: string): Promise<TrackResult> {
  const cands = candidates(raw);
  if (!cands.length) return { ok: false, message: "اكتب رقم تسجيل صحيح، مثلاً SU-GEK." };
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: "سجّل الدخول أولاً." };

  const { data, error } = await sb.functions.invoke("track-aircraft", { body: { registrations: cands } });
  if (error || !data || !Array.isArray(data.results)) return { ok: false, message: "تعذّر الوصول لخدمة التتبع الآن. جرّب بعد شوية." };

  const results = data.results as { input: string; status: "found" | "not_seen" | "source_unavailable"; source?: string; stale?: boolean; aircraft?: TrackAircraft }[];
  const r = results.find((x) => x.status === "found") ?? results.find((x) => x.status === "not_seen") ?? results[0];
  if (!r) return { ok: false, message: "لم تصل نتيجة من خدمة التتبع." };

  // Our own flights for this registration (read through RLS: only the user's company).
  const plain = r.input.replace("-", "");
  const { data: fl } = await sb.from("flights").select("flight_number, flight_date, direction")
    .or(`registration.ilike.${r.input},registration.ilike.${plain}`).order("flight_date", { ascending: false }).limit(3);
  const ours = (fl ?? []).map((f) => `${f.flight_number} · ${f.flight_date} · ${f.direction === "arrival" ? "وصول" : "مغادرة"}`);

  return { ok: true, input: r.input, status: r.status, source: r.source ?? null, stale: !!r.stale, aircraft: r.aircraft ?? null, ours };
}
