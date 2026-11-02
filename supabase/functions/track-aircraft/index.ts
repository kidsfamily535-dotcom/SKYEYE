// SKYEYE track-aircraft: where is this aircraft right now? Look-up by registration (tail number).
// Read-only, takes no action. Sources: free community ADS-B networks that share the ADSBExchange v2 API
// (no key). Tries several in turn because some of them block cloud/datacenter IPs.
// Coverage is not complete: an aircraft with its transponder off, or outside receiver coverage, is NOT shown.
const PROVIDERS: { name: string; base: string }[] = [
  { name: "adsb.lol", base: "https://api.adsb.lol/v2/reg/" },
  { name: "adsb.one", base: "https://api.adsb.one/v2/reg/" },
  { name: "airplanes.live", base: "https://api.airplanes.live/v2/reg/" },
  { name: "adsb.fi", base: "https://opendata.adsb.fi/api/v2/reg/" },
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Approximate reference points only, used to say "near X". Not for navigation.
const REF_AIRPORTS: [string, string, number, number][] = [
  ["HECA", "Cairo", 30.1219, 31.4056],
  ["HEBA", "Borg El Arab", 30.9177, 29.6964],
  ["HEAX", "Alexandria Nouzha", 31.1839, 29.9489],
  ["HESX", "Sphinx", 30.1117, 30.8978],
  ["HEGN", "Hurghada", 27.1783, 33.7994],
  ["HESH", "Sharm El Sheikh", 27.9773, 34.395],
  ["HELX", "Luxor", 25.671, 32.7066],
  ["HESN", "Aswan", 23.9644, 32.82],
  ["HEMA", "Marsa Alam", 25.5576, 34.5837],
  ["HLLB", "Benghazi", 32.0968, 20.2695],
  ["HLLM", "Tripoli Mitiga", 32.8941, 13.276],
  ["OEJN", "Jeddah", 21.6796, 39.1565],
  ["OERK", "Riyadh", 24.9576, 46.6988],
  ["OMDB", "Dubai", 25.2528, 55.3644],
  ["OMAA", "Abu Dhabi", 24.433, 54.6511],
  ["OTHH", "Doha", 25.2731, 51.6081],
  ["OJAI", "Amman", 31.7226, 35.9932],
  ["LTFM", "Istanbul", 41.2753, 28.7519],
  ["LGAV", "Athens", 37.9364, 23.9445],
  ["LCLK", "Larnaca", 34.8751, 33.6249],
  ["EGLL", "London Heathrow", 51.47, -0.4543],
  ["EDDF", "Frankfurt", 50.0333, 8.5706],
  ["LFPG", "Paris CDG", 49.0097, 2.5479],
];

function nm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3440.065; // nautical miles
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nearest(lat: number, lon: number) {
  let best: { icao: string; name: string; dist_nm: number } | null = null;
  for (const [icao, name, la, lo] of REF_AIRPORTS) {
    const d = nm(lat, lon, la, lo);
    if (!best || d < best.dist_nm) best = { icao, name, dist_nm: Math.round(d * 10) / 10 };
  }
  return best;
}

async function lookup(reg: string) {
  const tried: { provider: string; result: string }[] = [];
  let anyOk = false;
  for (const p of PROVIDERS) {
    try {
      const r = await fetch(p.base + encodeURIComponent(reg), {
        headers: { "User-Agent": "SKYEYE/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) { tried.push({ provider: p.name, result: `http_${r.status}` }); continue; }
      const j = await r.json().catch(() => null);
      const list = j && (j.ac ?? j.aircraft);
      if (!Array.isArray(list)) { tried.push({ provider: p.name, result: "bad_response" }); continue; }
      anyOk = true;
      if (!list.length) { tried.push({ provider: p.name, result: "not_seen" }); continue; }
      tried.push({ provider: p.name, result: "found" });
      return { ac: list[0], provider: p.name, tried, anyOk };
    } catch (e) {
      tried.push({ provider: p.name, result: e instanceof Error ? e.name : "error" });
    }
  }
  return { ac: null, provider: null, tried, anyOk };
}

function normalize(ac: any) {
  const onGround = ac.alt_baro === "ground";
  const lat = typeof ac.lat === "number" ? ac.lat : null;
  const lon = typeof ac.lon === "number" ? ac.lon : null;
  const ageS = ac.seen_pos ?? ac.seen ?? null;
  return {
    registration: ac.r ?? null,
    icao24_hex: ac.hex ?? null,
    type: ac.t ?? null,
    callsign: typeof ac.flight === "string" ? ac.flight.trim() || null : null,
    lat,
    lon,
    on_ground: onGround,
    altitude_ft: onGround ? 0 : typeof ac.alt_baro === "number" ? ac.alt_baro : null,
    ground_speed_kt: typeof ac.gs === "number" ? Math.round(ac.gs) : null,
    track_deg: typeof ac.track === "number" ? Math.round(ac.track) : null,
    vertical_rate_fpm: typeof ac.baro_rate === "number" ? ac.baro_rate : null,
    squawk: ac.squawk ?? null,
    emergency: ac.emergency && ac.emergency !== "none" ? ac.emergency : null,
    last_position_age_s: typeof ageS === "number" ? Math.round(ageS) : null,
    nearest_reference_airport: lat != null && lon != null ? nearest(lat, lon) : null,
    map_url: ac.hex ? `https://globe.adsb.lol/?icao=${String(ac.hex).toLowerCase()}` : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = req.method === "POST" ? await req.json() : Object.fromEntries(new URL(req.url).searchParams);
    const regs: string[] = (Array.isArray(body.registrations) ? body.registrations : String(body.registration ?? body.registrations ?? "").split(","))
      .map((x: unknown) => String(x).trim().toUpperCase())
      .filter((x: string) => /^[A-Z0-9-]{3,8}$/.test(x));
    if (!regs.length || regs.length > 5) return json({ error: "provide 1-5 registrations, e.g. SU-GDA" }, 400);

    const results = [];
    for (const reg of regs) {
      const r = await lookup(reg);
      if (r.ac) {
        const a = normalize(r.ac);
        results.push({ input: reg, status: "found", fetched_utc: new Date().toISOString(), source: r.provider, stale: (a.last_position_age_s ?? 0) > 120, aircraft: a, tried: r.tried });
      } else if (r.anyOk) {
        results.push({ input: reg, status: "not_seen", fetched_utc: new Date().toISOString(), tried: r.tried, note: "not currently received by the ADS-B networks (transponder off, on the ground out of coverage, or not flying)" });
      } else {
        results.push({ input: reg, status: "source_unavailable", fetched_utc: new Date().toISOString(), tried: r.tried });
      }
    }
    console.log(JSON.stringify({ fn: "track-aircraft", regs, statuses: results.map((x) => x.status) }));
    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
