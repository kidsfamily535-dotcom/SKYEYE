"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoDistance, geoInterpolate, geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { RadarCounts } from "@/lib/data";
import type { RadarFlight } from "@/lib/cockpit";
import { geoOf } from "@/lib/airport-geo";

// Tower map for the home page: real geography (Natural Earth, bundled, no tile server) with every counted flight drawn as an aircraft.
//  - on the ground: parked at its station airport (ATA recorded, no ATD yet);
//  - inbound / late arrival: on the great-circle route from its origin to the station, at a position ESTIMATED from the arrival schedule
//    (no live tracking data exists here, so the map says so on the card and in the note);
//  - flights whose airports have no coordinates, or that have no arrival time, are left off and counted in the note.
// Read only: it draws what the cockpit already knows and never writes anything.

const BW = 640, BH = 460, PAD = 70, MAX_DRAW = 160; // BW x BH is the world at zoom 1; the drawing itself is in real screen pixels
const COLOR = { ground: "#FFC107", inbound: "#8FB8FF", late: "#FF766C" } as const;
type Kind = RadarFlight["kind"];
const PLANE = "M0 -6.5L1.3 -2.2L6 1L6 2.4L1.3 1L1 4.6L2.6 5.8L2.6 7L0 6.4L-2.6 7L-2.6 5.8L-1 4.6L-1.3 1L-6 2.4L-6 1L-1.3 -2.2Z";
const base = geoMercator().scale(BW / (2 * Math.PI)).translate([BW / 2, BH / 2]);
const pathGen = geoPath(base);
const TXT = {
  ar: { ground: "على الأرض", inbound: "قادمة", late: "متأخرة", lateGround: "متأخرة عن الإقلاع", lateAir: "متأخرة عن الوصول", open: "فتح الرحلة", close: "إغلاق", zoomIn: "تكبير", zoomOut: "تصغير", fit: "ملاءمة كل الرحلات",
    est: "الموضع تقديري على المسار من جدول الوصول، وليس تتبعًا حيًا.", parked: "ATA مسجّل والطائرة ما غادرتش بعد.", preDep: "ما أقلعتش بحسب الجدول (تقدير).", sta: "الوصول المخطط", eta: "المتوقع", ata: "الوصول الفعلي", std: "الإقلاع المخطط",
    aria: "خريطة البرج: كل طائرة رحلة محسوبة", note: "الموضع على المسار تقدير من جدول الوصول وليس تتبعًا حيًا.", left: (n: number) => `${n} رحلة ما اتعرضتش (مطار بدون إحداثيات أو بدون وقت وصول).`, capped: (n: number) => `معروض ${n} رحلة من الأهم.`, loading: "تحميل الخريطة…" },
  en: { ground: "On ground", inbound: "Inbound", late: "Late", lateGround: "Late to depart", lateAir: "Late to arrive", open: "Open flight", close: "Close", zoomIn: "Zoom in", zoomOut: "Zoom out", fit: "Fit all flights",
    est: "Position is estimated along the route from the arrival schedule, not live tracking.", parked: "ATA recorded; the aircraft has not left yet.", preDep: "Not yet departed by schedule (estimate).", sta: "Planned arrival", eta: "Expected", ata: "Actual arrival", std: "Planned departure",
    aria: "Tower map: one aircraft per counted flight", note: "Positions along a route are estimated from the arrival schedule, not live tracking.", left: (n: number) => `${n} flight(s) not shown (airport without coordinates, or no arrival time).`, capped: (n: number) => `Showing ${n} flights, most important first.`, loading: "Loading map…" },
} as const;

const hm = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Item = { f: RadarFlight; lon: number; lat: number; key: string | null; head: number; route: [[number, number], [number, number]] | null; est: boolean; pre: boolean };
type View = { k: number; tx: number; ty: number };
type Topo = Parameters<typeof feature>[0];

function place(f: RadarFlight, now: number): Item | null {
  const st = geoOf(f.station);
  if (f.landed) {
    if (!st) return null;
    return { f, lon: st.lon, lat: st.lat, key: f.station!.toUpperCase(), head: hash(f.id) % 360, route: null, est: false, pre: false };
  }
  const or = geoOf(f.origin);
  const eta = f.eta ?? f.sta;
  if (!st || !or || !eta) return null;
  const a: [number, number] = [or.lon, or.lat], b: [number, number] = [st.lon, st.lat];
  const km = geoDistance(a, b) * 6371;
  const dur = (km / 800) * 60 + 30; // minutes: cruise at about 800 km/h plus taxi, climb and descent
  const left = (+new Date(eta) - now) / 60000;
  const raw = 1 - left / dur;
  const p = clamp(raw, 0, 0.97);
  const at = geoInterpolate(a, b);
  const [lon, lat] = at(p);
  const [x1, y1] = base(at(p)) ?? [0, 0]; const [x2, y2] = base(at(Math.min(1, p + 0.02))) ?? [0, 0];
  const head = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 90;
  return { f, lon, lat, key: raw <= 0 ? `pre-${f.origin!.toUpperCase()}` : raw >= 0.97 ? f.station!.toUpperCase() : null, head, route: [a, b], est: true, pre: raw <= 0 };
}

const RINGS: { k: keyof RadarCounts; c: string }[] = [{ k: "onGround", c: "#FFC107" }, { k: "inbound", c: "#8FB8FF" }, { k: "delayed", c: "#FF766C" }, { k: "awaitingMsg", c: "#3FB58A" }];

export default function CommandMap({ counts, flights, lang, labels, call }: { counts: RadarCounts; flights: RadarFlight[]; lang: "ar" | "en"; labels: Record<keyof RadarCounts, string>; call?: React.ReactNode }) {
  const T = TXT[lang];
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const measured = useRef(false);
  const [size, setSize] = useState({ w: 640, h: 400 });
  const [hov, setHov] = useState<string | null>(null);
  const [land, setLand] = useState<{ fill: string; borders: string } | null>(null);
  const [view, setView] = useState<View>({ k: 5, tx: 0, ty: 0 });
  const [now, setNow] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hide, setHide] = useState<Record<Kind, boolean>>({ ground: false, inbound: false, late: false });
  const fitted = useRef(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  // Land: the coarse world loads first, then the detailed one replaces it.
  useEffect(() => {
    let alive = true;
    const build = (topo: Topo & { objects: Record<string, never> }) => {
      const t = topo as unknown as { objects: { countries: never } };
      const fc = feature(topo, t.objects.countries) as unknown as { features: { id?: string }[] };
      const keep = { ...fc, features: fc.features.filter((x) => x.id !== "010") }; // no Antarctica on a Mercator map
      const fill = pathGen(keep as never) ?? "";
      const borders = pathGen(mesh(topo, t.objects.countries, (a: unknown, b: unknown) => a !== b) as never) ?? "";
      if (alive) setLand({ fill, borders });
    };
    import("world-atlas/countries-110m.json").then((m) => build(m.default as never));
    const later = setTimeout(() => { import("world-atlas/countries-50m.json").then((m) => build(m.default as never)); }, 700);
    return () => { alive = false; clearTimeout(later); };
  }, []);

  // The drawing is in real pixels: measure the box and follow it when it resizes.
  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { measured.current = true; setSize({ w: Math.round(r.width), h: Math.round(r.height) }); } };
    read();
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  const items = useMemo(() => {
    if (now === null) return [] as Item[];
    const order: Record<Kind, number> = { late: 0, ground: 1, inbound: 2 };
    return [...flights].sort((a, b) => order[a.kind] - order[b.kind]).slice(0, MAX_DRAW).map((f) => place(f, now)).filter((x): x is Item => x !== null);
  }, [flights, now]);
  const shown = Math.min(flights.length, MAX_DRAW);
  const unplaced = now === null ? 0 : shown - items.length;

  // Airports that have at least one flight, with their IATA label.
  const airports = useMemo(() => {
    const s = new Set<string>();
    for (const f of flights.slice(0, MAX_DRAW)) for (const c of [f.station, f.origin]) if (c && geoOf(c)) s.add(c.toUpperCase());
    return [...s].map((c) => ({ code: c, g: geoOf(c)!, xy: base([geoOf(c)!.lon, geoOf(c)!.lat]) as [number, number] }));
  }, [flights]);

  const fit = useCallback(() => {
    const pts: [number, number][] = [...airports.map((a) => a.xy), ...items.map((i) => base([i.lon, i.lat]) as [number, number])];
    if (pts.length === 0) { const c = base([30, 28]) as [number, number]; setView({ k: 5, tx: size.w / 2 - c[0] * 5, ty: size.h / 2 - c[1] * 5 }); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const bw = Math.max(x1 - x0, 14), bh = Math.max(y1 - y0, 10);
    const k = clamp(Math.min((size.w - 2 * PAD) / bw, (size.h - 2 * PAD) / bh), 1.2, 40);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    setView({ k, tx: size.w / 2 - cx * k, ty: size.h / 2 - cy * k });
  }, [airports, items, size]);

  useEffect(() => { if (!fitted.current && now !== null && measured.current) { fit(); fitted.current = true; } }, [fit, now, size]);

  const zoomAt = useCallback((factor: number, cx = size.w / 2, cy = size.h / 2) => {
    setView((v) => { const k = clamp(v.k * factor, 1, 90); const r = k / v.k; return { k, tx: cx - (cx - v.tx) * r, ty: cy - (cy - v.ty) * r }; });
  }, [size]);

  // The wheel needs a non-passive listener to stop the page from scrolling while the map zooms.
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0016), ((e.clientX - r.left) / r.width) * size.w, ((e.clientY - r.top) / r.height) * size.h);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => { drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const r = e.currentTarget.getBoundingClientRect(); const sc = size.w / r.width;
    const dx = (e.clientX - d.x), dy = (e.clientY - d.y);
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, tx: d.tx + dx * sc, ty: d.ty + dy * sc }));
  };
  const onUp = () => { const d = drag.current; drag.current = null; if (d && !d.moved) setSel(null); };

  // Screen position of every drawn aircraft: projected point, then a small fan-out so parked aircraft and not-yet-departed ones don't sit on top of each other.
  // Screen position of every drawn aircraft. A crowded airport (more than 14 aircraft parked or piled at it) collapses into one count bubble
  // until you zoom in; below that the aircraft fan out around the airport so none sits on top of another.
  const placed = useMemo(() => {
    const vis = items.filter((i) => !hide[i.f.kind]);
    const groups = new Map<string, Item[]>();
    for (const i of vis) if (i.key) { const g = groups.get(i.key); if (g) g.push(i); else groups.set(i.key, [i]); }
    const collapsed = new Set<string>();
    const clusters: { key: string; n: number; x: number; y: number; late: boolean; ground: boolean }[] = [];
    if (view.k < 8) for (const [key, list] of groups) if (list.length > 14) {
      collapsed.add(key);
      const [bx, by] = base([list[0].lon, list[0].lat]) as [number, number];
      clusters.push({ key, n: list.length, x: bx * view.k + view.tx, y: by * view.k + view.ty, late: list.some((i) => i.f.kind === "late"), ground: list.some((i) => i.f.kind === "ground") });
    }
    const idx = new Map<string, number>();
    const planes = vis.filter((i) => !(i.key && collapsed.has(i.key))).map((i) => {
      const [bx, by] = base([i.lon, i.lat]) as [number, number];
      let ox = 0, oy = 0;
      if (i.key) { const n = idx.get(i.key) ?? 0; idx.set(i.key, n + 1); const r = 7.5 * Math.sqrt(n + (n === 0 ? 0 : 0.6)) * clamp(Math.sqrt(view.k / 3), 1, 2.6); const a = n * 2.399; ox = r * Math.cos(a); oy = r * Math.sin(a); }
      return { i, x: bx * view.k + view.tx + ox, y: by * view.k + view.ty + oy };
    });
    return { vis, planes, clusters };
  }, [items, hide, view]);

  const selItem = sel ? items.find((i) => i.f.id === sel) ?? null : null;
  const kindText = (i: Item) => (i.f.kind === "ground" ? T.ground : i.f.kind === "inbound" ? T.inbound : i.f.landed ? T.lateGround : T.lateAir);
  const aria = `${T.aria}: ${T.ground} ${counts.onGround ?? "—"}، ${T.inbound} ${counts.inbound ?? "—"}، ${T.late} ${counts.delayed ?? "—"}`;
  const cnt = (k: Kind) => items.filter((i) => i.f.kind === k).length;

  return (
    <div className="cr-scope-wrap">
      <div className="cm-stage">
      <div className="cm" dir="ltr" ref={boxRef}>
        <svg ref={svgRef} className="cm-svg" viewBox={`0 0 ${size.w} ${size.h}`} role="group" aria-label={aria} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect width={size.w} height={size.h} className="cm-sea" />
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {land && <><path d={land.fill} className="cm-land" /><path d={land.borders} className="cm-borders" vectorEffect="non-scaling-stroke" /></>}
            {placed.vis.filter((i) => i.route && !i.pre).map((i) => {
              const d = pathGen({ type: "LineString", coordinates: i.route as [number, number][] }) ?? "";
              return <path key={`r-${i.f.id}`} d={d} className={`cm-route${sel === i.f.id ? " on" : ""}`} style={{ stroke: COLOR[i.f.kind] }} vectorEffect="non-scaling-stroke" />;
            })}
          </g>

          {airports.map((a) => {
            const x = a.xy[0] * view.k + view.tx, y = a.xy[1] * view.k + view.ty;
            if (x < -20 || x > size.w + 20 || y < -20 || y > size.h + 20) return null;
            // An airport with parked aircraft around it keeps its code above the cluster.
            const parked = placed.vis.filter((i) => i.key === a.code).length;
            const up = placed.clusters.some((c) => c.key === a.code) ? -26 : parked > 0 ? -(7.5 * Math.sqrt(parked) * clamp(Math.sqrt(view.k / 3), 1, 2.6) + 12) : 0;
            return <g key={a.code} className="cm-ap" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}><circle r="3" /><text x={up ? 0 : 6} y={up ? up : 3.2} textAnchor={up ? "middle" : "start"}>{a.code}</text></g>;
          })}

          {[...placed.planes].sort((a, b) => Number(sel === a.i.f.id) - Number(sel === b.i.f.id)).map(({ i, x, y }) => {
            if (x < -20 || x > size.w + 20 || y < -20 || y > size.h + 20) return null;
            const c = COLOR[i.f.kind]; const on = sel === i.f.id; const label = on || hov === i.f.id || view.k >= 10;
            return (
              <g key={i.f.id} className={`cm-pl${on ? " on" : ""}${i.est ? " est" : ""}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} role="button" tabIndex={0} aria-label={`${i.f.no} ${kindText(i)}`}
                onPointerDown={(e) => e.stopPropagation()} onPointerEnter={() => setHov(i.f.id)} onPointerLeave={() => setHov(null)} onClick={(e) => { e.stopPropagation(); setSel(on ? null : i.f.id); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(on ? null : i.f.id); } }}>
                <circle r="13" fill="transparent" />
                <circle r="9" fill={c} opacity=".14" />
                {on && <circle r="12" fill="none" stroke="#fff" strokeWidth="1.2" />}
                <path d={PLANE} transform={`rotate(${i.head.toFixed(0)}) scale(1.55)`} fill={c} stroke="#0B0F14" strokeWidth=".55" strokeLinejoin="round" />
                {label && <text x="11" y="-7" className="cm-tag"><tspan>{i.f.no}</tspan></text>}
              </g>
            );
          })}
          {placed.clusters.map((c) => {
            const col = c.late ? COLOR.late : c.ground ? COLOR.ground : COLOR.inbound;
            return (
              <g key={`c-${c.key}`} className="cm-cl" transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`} role="button" tabIndex={0} aria-label={`${c.key}: ${c.n}`}
                onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); zoomAt(2.4, c.x, c.y); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); zoomAt(2.4, c.x, c.y); } }}>
                <circle r="21" fill={col} opacity=".18" /><circle r="14" fill="#0E141B" stroke={col} strokeWidth="1.8" />
                <text y="4" textAnchor="middle" className="cm-cl-n" fill={col}>{c.n}</text>
              </g>);
          })}
        </svg>

        <div className="cm-chips" role="group" aria-label={T.aria}>
          {(["ground", "inbound", "late"] as Kind[]).map((k) => (
            <button key={k} type="button" aria-pressed={!hide[k]} className={hide[k] ? "off" : ""} style={{ ["--c" as string]: COLOR[k] }} onClick={() => setHide((h) => ({ ...h, [k]: !h[k] }))}><i />{T[k]}<b className="ltr">{cnt(k)}</b></button>
          ))}
        </div>
        <div className="cm-zoom">
          <button type="button" aria-label={T.zoomIn} onClick={() => zoomAt(1.6)}>+</button>
          <button type="button" aria-label={T.zoomOut} onClick={() => zoomAt(1 / 1.6)}>−</button>
          <button type="button" aria-label={T.fit} title={T.fit} onClick={fit}>⌖</button>
        </div>
        {!land && <p className="cm-loading">{T.loading}</p>}

        {selItem && (
          <aside className="cm-card" dir={lang === "ar" ? "rtl" : "ltr"} style={{ ["--c" as string]: COLOR[selItem.f.kind] }}>
            <button type="button" className="cm-x" aria-label={T.close} onClick={() => setSel(null)}>×</button>
            <p className="cm-card-h"><b className="ltr">{selItem.f.no}</b><span>{kindText(selItem)}</span></p>
            <p className="cm-card-r ltr">{[selItem.f.origin, selItem.f.station].filter(Boolean).join(" → ")}{selItem.f.reg ? ` · ${selItem.f.reg}` : ""}</p>
            <dl className="cm-times ltr">
              {selItem.f.landed ? <div><dt>{T.ata}</dt><dd>{hm(selItem.f.ata)}</dd></div> : <><div><dt>{T.sta}</dt><dd>{hm(selItem.f.sta)}</dd></div><div><dt>{T.eta}</dt><dd>{hm(selItem.f.eta)}</dd></div></>}
              {selItem.f.landed && <div><dt>{T.std}</dt><dd>{hm(selItem.f.std)}</dd></div>}
            </dl>
            <p className="cm-card-n">{selItem.est ? (selItem.pre ? T.preDep : T.est) : T.parked}</p>
            <Link className="cm-go" href={`/flights?id=${selItem.f.id}`}>{T.open}</Link>
          </aside>
        )}
      </div>
      {call && <div className="cm-call">{call}</div>}
      </div>
      <ul className="cr-legend">
        {RINGS.map((x) => (
          <li key={x.k}><Link href="/flights" style={{ ["--c" as string]: x.c }}><i /><span>{labels[x.k]}</span><b className="ltr">{counts[x.k] ?? "—"}</b></Link></li>))}
      </ul>
      <p className="cr-note">{T.note}{unplaced > 0 ? ` ${T.left(unplaced)}` : ""}{flights.length > MAX_DRAW ? ` ${T.capped(MAX_DRAW)}` : ""}</p>
    </div>
  );
}
