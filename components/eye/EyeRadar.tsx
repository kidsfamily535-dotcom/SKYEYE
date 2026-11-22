"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { MapAc } from "./EyeMap";

export type RadarTurn = { id: string; reg: string | null; arrNo: string | null; depNo: string | null; arrAt: string | null; depAt: string | null; inBlock: string | null; station: string | null; phase: "ground" | "approach" | "later" };
export type RadarAirport = { code: string; lat: number; lon: number; name: string };

const EyeMap = dynamic(() => import("./EyeMap"), { ssr: false, loading: () => <div className="eye-lf eye-lf-load" /> });

// Flightradar-style flight map on a REAL map. There is no live tracking feed behind it: each aircraft is placed from the flight schedule
// (on stand = around the airport pin, approaching = on the approach line at a distance from its planned arrival time, later today = further out).
const C = { ground: "#FFC107", late: "#E8A33D", approach: "#8FB8FF", later: "#B5B5B5" };
const CHIPS = ["CAI", "HBE", "SSH", "HRG", "LXR", "ASW"];
const T = {
  ar: { title: "خريطة الرحلات", note: "الأماكن على الخريطة مبنية على مواعيد الرحلات وليست تتبعًا حيًا للطيارات. اضغط على أي طيارة أو رحلة لفتح الوقفة.", ok: "على الموعد", late: "بعد الموعد المخطط", onStand: "على الوقفة من", dep: "الإقلاع المخطط", arr: "الوصول المخطط", hint: "اضغط لفتح الوقفة", none: "مفيش رحلات على الأرض أو قريبة دلوقتي.", utc: "UTC", st: { ground: "على الأرض", approach: "في الاقتراب", later: "لاحقًا اليوم" } as Record<string, string>, airport: "المطار" },
  en: { title: "Flights map", note: "Positions on the map come from the flight schedule, not live aircraft tracking. Click any aircraft or flight to open its stand.", ok: "On time", late: "Past planned time", onStand: "On stand since", dep: "Planned departure", arr: "Planned arrival", hint: "Click to open the stand", none: "No flights on the ground or close right now.", utc: "UTC", st: { ground: "On the ground", approach: "Approaching", later: "Later today" } as Record<string, string>, airport: "Airport" },
};
const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const dest = (lat: number, lon: number, brg: number, km: number): [number, number] => {
  const d = km / 6371, b = (brg * Math.PI) / 180, p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [(p2 * 180) / Math.PI, ((((l2 * 180) / Math.PI) + 540) % 360) - 180];
};
const APPROACH_FROM = 300; // bearing the approach line comes from (schematic)

export default function EyeRadar({ turns, ws, lang, nowMs, airport }: { turns: RadarTurn[]; ws: string; lang: "ar" | "en"; nowMs: number; airport: RadarAirport }) {
  const x = T[lang];
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [hov, setHov] = useState<string | null>(null);
  const href = (t: RadarTurn) => `/eye/turn/${t.id}?ws=${ws}&d=${t.arrNo ? "arrival" : "departure"}`;
  const label = (t: RadarTurn) => t.depNo ?? t.arrNo ?? "—";
  const isLate = (t: RadarTurn) => (t.phase === "ground" ? !!t.depAt && nowMs > Date.parse(t.depAt) : t.phase === "approach" ? !!t.arrAt && nowMs > Date.parse(t.arrAt) : false);
  const tm = (t: RadarTurn) => Date.parse((t.phase === "ground" ? t.depAt : t.arrAt) ?? "") || 0;
  const ground = turns.filter((t) => t.phase === "ground").sort((a, b) => tm(a) - tm(b));
  const approach = turns.filter((t) => t.phase === "approach").sort((a, b) => tm(a) - tm(b));
  const later = turns.filter((t) => t.phase === "later").sort((a, b) => tm(a) - tm(b));
  const apHref = (code: string) => { const p = new URLSearchParams(sp.toString()); p.set("ap", code); return `${path}?${p.toString()}`; };

  const { aircraft, fit } = useMemo(() => {
    const ac: MapAc[] = [], fitPts: [number, number][] = [];
    const slot = (i: number, row0: number): [number, number] => [((i % 5) - 2) * 74, row0 + Math.floor(i / 5) * 38];
    ground.forEach((t, i) => ac.push({ id: t.id, label: label(t), col: isLate(t) ? C.late : C.ground, heading: 0, hollow: false, off: slot(i, 44) }));
    let lastKm = -1e9, landed = 0;
    approach.forEach((t) => {
      const min = (tm(t) - nowMs) / 60000;
      if (min < 0) { ac.push({ id: t.id, label: label(t), col: C.late, heading: 90, hollow: false, off: slot(landed++, -78 - 0) }); return; }
      let km = 6 + Math.min(min, 60) * 2.2;
      if (km - lastKm < 16) km = lastKm + 16;
      lastKm = km;
      const ll = dest(airport.lat, airport.lon, APPROACH_FROM, km);
      ac.push({ id: t.id, label: label(t), col: C.approach, heading: (APPROACH_FROM + 180) % 360, hollow: false, ll });
      fitPts.push(ll);
    });
    later.forEach((t, i) => { const h = Math.min(Math.max((tm(t) - nowMs) / 3600000, 1), 6); ac.push({ id: t.id, label: label(t), col: C.later, heading: 110, hollow: true, ll: dest(airport.lat, airport.lon, APPROACH_FROM - 25 + (i % 5) * 14, 150 + h * 22) }); });
    return { aircraft: ac, fit: fitPts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, nowMs, airport.code]);
  const center = useMemo<[number, number]>(() => [airport.lat, airport.lon], [airport.lat, airport.lon]);
  const cur = turns.find((t) => t.id === hov) ?? null;
  const groups: [string, RadarTurn[], string][] = [["ground", ground, C.ground], ["approach", approach, C.approach], ["later", later, C.later]];

  return (
    <section className="eye-rd" aria-label={x.title}>
      <div className="eye-rd-map">
        <nav className="eye-rd-ap" aria-label={x.airport}>
          {CHIPS.map((c) => <Link key={c} href={apHref(c)} className={`chip-link${c === airport.code ? " on" : ""}`}>{c}</Link>)}
        </nav>
        <EyeMap center={center} airportLabel={`${airport.name} (${airport.code})`} aircraft={aircraft} hov={hov} onHover={setHov} onOpen={(id) => { const t = turns.find((q) => q.id === id); if (t) router.push(href(t)); }} fit={fit} />
        {cur && (
          <div className="eye-rd-tip" role="status">
            <span className="eye-rd-r1"><b className="ltr">{cur.arrNo ?? "—"} / {cur.depNo ?? "—"}</b>{cur.reg && <span className="eye-rd-pill ltr">{cur.reg}</span>}</span>
            <span className="eye-rd-s2">{x.st[cur.phase]}</span>
            {cur.station && <span className="eye-rd-s2">{cur.station}</span>}
            {cur.inBlock && <span className="eye-rd-s2 ltr">{x.onStand} {hm(cur.inBlock)} {x.utc}</span>}
            <span className="eye-rd-s2 ltr">{cur.phase === "ground" ? `${x.dep} ${hm(cur.depAt)} ${x.utc}` : `${x.arr} ${hm(cur.arrAt)} ${x.utc}`}</span>
            <span className="eye-rd-hint">{x.hint}</span>
          </div>
        )}
        <p className="eye-rd-note">{turns.length === 0 ? `${x.none} ` : ""}{x.note}</p>
      </div>
      <aside className="eye-rd-panel">
        {groups.map(([k, l, col]) => l.length > 0 && (
          <div key={k}>
            <h3 className="eye-rd-h"><i style={{ background: col }} />{x.st[k]} <small>{l.length}</small></h3>
            {l.map((t) => (
              <Link key={t.id} href={href(t)} className={`eye-rd-card${hov === t.id ? " on" : ""}`} onMouseEnter={() => setHov(t.id)} onMouseLeave={() => setHov(null)}>
                <span className="eye-rd-r1"><b className="ltr">{label(t)}</b>{t.reg && <span className="eye-rd-pill ltr">{t.reg}</span>}{t.phase !== "later" && <span className={`eye-rd-pill ${isLate(t) ? "w" : "k"}`}>{isLate(t) ? x.late : x.ok}</span>}</span>
                <span className="eye-rd-s2 ltr">{t.phase === "ground" ? `${x.dep} ${hm(t.depAt)} ${x.utc}` : `${x.arr} ${hm(t.arrAt)} ${x.utc}`}</span>
              </Link>
            ))}
          </div>
        ))}
      </aside>
    </section>
  );
}
