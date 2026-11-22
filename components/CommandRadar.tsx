"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RadarCounts } from "@/lib/data";
import type { RadarFlight } from "@/lib/cockpit";
import { AIRPORT_GEO, geoOf } from "@/lib/airport-geo";
import type { MapAc } from "@/components/eye/EyeMap";
import "./command-radar.css";

const EyeMap = dynamic(() => import("@/components/eye/EyeMap"), { ssr: false, loading: () => <div className="eye-lf" /> });

// The command-page radar: the same real map and flights panel as the airline portal. Nothing here is live tracking: every position is
// derived from the schedule (on stand = around the airport pin; arriving = on the line toward the origin, farther out the later it lands).
const C = { ground: "#FFC107", late: "#FF766C", approach: "#8FB8FF", later: "#B5B5B5" } as const;
type Phase = keyof typeof C;
const RINGS = [15, 30, 45, 60].map((m) => ({ km: 6 + m * 2.2, label: `${m}′` }));
const TXT = {
  ar: { station: "المحطة / المطار", ground: "على الأرض", late: "متأخرة", approach: "في الاقتراب", later: "لاحقًا", none: "مفيش رحلات للمحطة دي دلوقتي.", dep: "الإقلاع المخطط", arr: "الوصول المتوقع", ata: "وصلت", hint: "اضغط لفتح الرحلة", note: "المواضع على الخريطة تقدير من جدول الرحلات وليست تتبعًا حيًا للطيارات.", skipped: (n: number) => `${n} رحلة ما اتعرضتش (بدون وقت وصول أو مطار بلا إحداثيات).`, utc: "UTC" },
  en: { station: "Station / airport", ground: "On the ground", late: "Late", approach: "Approaching", later: "Later", none: "No flights for this station right now.", dep: "Planned departure", arr: "Expected arrival", ata: "Landed", hint: "Click to open the flight", note: "Positions on the map are estimated from the schedule, not live aircraft tracking.", skipped: (n: number) => `${n} flight(s) not shown (no arrival time, or an airport without coordinates).`, utc: "UTC" },
};
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
const dest = (lat: number, lon: number, brg: number, km: number): [number, number] => {
  const d = km / 6371, b = rad(brg), p1 = rad(lat), l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [deg(p2), ((deg(l2) + 540) % 360) - 180];
};
const bearing = (la1: number, lo1: number, la2: number, lo2: number) => {
  const y = Math.sin(rad(lo2 - lo1)) * Math.cos(rad(la2)), x = Math.cos(rad(la1)) * Math.sin(rad(la2)) - Math.sin(rad(la1)) * Math.cos(rad(la2)) * Math.cos(rad(lo2 - lo1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
};
type Row = { f: RadarFlight; phase: Phase; ac: MapAc } | null;

export default function CommandRadar({ counts, flights, lang, labels }: { counts: RadarCounts; flights: RadarFlight[]; lang: "ar" | "en"; labels: Record<keyof RadarCounts, string> }) {
  const x = TXT[lang];
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  // stations that have flights, most flights first
  const stations = useMemo(() => {
    const n = new Map<string, number>();
    flights.forEach((f) => { const c = f.station?.trim().toUpperCase(); if (c && geoOf(c)) n.set(c, (n.get(c) ?? 0) + 1); });
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [flights]);
  const code = pick && (stations.includes(pick) || AIRPORT_GEO[pick]) ? pick : stations[0] ?? "CAI";
  const apt = geoOf(code) ?? AIRPORT_GEO.CAI;
  const mine = useMemo(() => flights.filter((f) => f.station?.trim().toUpperCase() === code), [flights, code]);

  const { rows, skipped } = useMemo(() => {
    const out: NonNullable<Row>[] = []; let skip = 0;
    if (now === null) return { rows: out, skipped: 0 };
    for (const f of mine) {
      const mk = (phase: Phase, extra: Partial<MapAc>): NonNullable<Row> => ({ f, phase, ac: { id: f.id, label: f.no, sub: f.reg ?? "", col: C[phase], heading: 0, hollow: phase === "later", ...extra } });
      if (f.landed) { out.push(mk(f.kind === "late" ? "late" : "ground", { grp: "down" })); continue; }
      const eta = f.eta ?? f.sta;
      if (!eta) { skip++; continue; }
      const min = (Date.parse(eta) - now) / 60000;
      const og = geoOf(f.origin);
      const brg = og ? bearing(apt.lat, apt.lon, og.lat, og.lon) : 300;
      if (min < 0) { out.push(mk("late", { grp: "up", heading: 90 })); continue; }
      const phase: Phase = min <= 60 ? "approach" : "later";
      const km = min <= 60 ? 6 + min * 2.2 : 150 + Math.min(min / 60, 6) * 22;
      out.push(mk(phase, { ll: dest(apt.lat, apt.lon, brg, km), heading: (brg + 180) % 360 }));
    }
    return { rows: out, skipped: skip };
  }, [mine, now, apt.lat, apt.lon]);

  const aircraft = useMemo(() => rows.map((r) => r.ac), [rows]);
  const fit = useMemo(() => rows.filter((r) => r.phase === "approach" && r.ac.ll).map((r) => r.ac.ll as [number, number]), [rows]);
  const center = useMemo<[number, number]>(() => [apt.lat, apt.lon], [apt.lat, apt.lon]);
  const open = (id: string) => router.push(`/flights?id=${encodeURIComponent(id)}`);
  const cur = rows.find((r) => r.f.id === hov) ?? null;
  const groups = (["ground", "late", "approach", "later"] as Phase[]).map((p) => [p, rows.filter((r) => r.phase === p)] as const);
  const opts = [...new Set([code, ...stations])];

  return (
    <div className="cx">
      <div className="cx-map">
        <EyeMap rings={RINGS} center={center} airportLabel={`${apt.name} (${code})`} aircraft={aircraft} hov={hov} onHover={setHov} onOpen={open} fit={fit} />
        {cur && (
          <div className="cx-tip" role="status">
            <span className="cx-r1"><b className="ltr">{cur.f.no}</b>{cur.f.reg && <span className="cx-pill ltr">{cur.f.reg}</span>}</span>
            <span className="cx-s2">{x[cur.phase]}{cur.f.origin ? ` · ${cur.f.origin} → ${cur.f.station}` : ""}</span>
            <span className="cx-s2 ltr">{cur.f.landed ? `${x.ata} ${hm(cur.f.ata)} · ${x.dep} ${hm(cur.f.std)} ${x.utc}` : `${x.arr} ${hm(cur.f.eta ?? cur.f.sta)} ${x.utc}`}</span>
            <span className="cx-hint">{x.hint}</span>
          </div>
        )}
        <ul className="cx-legend">
          {(["onGround", "inbound", "delayed", "awaitingMsg"] as (keyof RadarCounts)[]).map((k, i) => (
            <li key={k}><Link href="/flights" style={{ ["--c" as string]: ["#FFC107", "#8FB8FF", "#FF766C", "#3FB58A"][i] }}><i /><span>{labels[k]}</span><b className="ltr">{counts[k] ?? "—"}</b></Link></li>
          ))}
        </ul>
        <p className="cx-note">{x.note}{skipped > 0 ? ` ${x.skipped(skipped)}` : ""}</p>
      </div>
      <aside className="cx-panel">
        <label className="cx-sel">
          <span>{x.station}</span>
          <select value={code} onChange={(e) => setPick(e.target.value)} aria-label={x.station}>
            {opts.map((c) => <option key={c} value={c}>{geoOf(c)?.name ?? c} — {c}</option>)}
          </select>
        </label>
        <div className="cx-list">
          {rows.length === 0 && <p className="cx-empty">{x.none}</p>}
          {groups.map(([p, l]) => l.length > 0 && (
            <div key={p}>
              <h3 className="cx-h"><i style={{ background: C[p] }} />{x[p]} <small>{l.length}</small></h3>
              {l.map((r) => (
                <Link key={r.f.id} href={`/flights?id=${encodeURIComponent(r.f.id)}`} className={`cx-card${hov === r.f.id ? " on" : ""}`} onMouseEnter={() => setHov(r.f.id)} onMouseLeave={() => setHov(null)}>
                  <span className="cx-r1"><b className="ltr">{r.f.no}</b>{r.f.reg && <span className="cx-pill ltr">{r.f.reg}</span>}</span>
                  <span className="cx-s2 ltr">{r.f.landed ? `${x.dep} ${hm(r.f.std)} ${x.utc}` : `${x.arr} ${hm(r.f.eta ?? r.f.sta)} ${x.utc}`}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
