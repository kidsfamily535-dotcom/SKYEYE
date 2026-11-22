"use client";
import "leaflet/dist/leaflet.css";
import "./eye-map.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

// grp: aircraft that sit at the airport itself (no coordinates of their own) are laid out in a pixel grid under ("down") or above ("up") the airport pin.
export type MapAc = { id: string; label: string; sub?: string; col: string; heading: number; hollow: boolean; ll?: [number, number]; grp?: "down" | "up" };
export type Ring = { km: number; label: string };
const PL = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";
const esc = (s: string) => s.replace(/[<>&"]/g, "");
const planeIcon = (a: MapAc) => L.divIcon({
  className: "eye-ac", iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<svg viewBox="-40 -38 80 80" width="30" height="30" style="transform:rotate(${a.heading}deg)"><path d="${PL}" fill="${a.hollow ? "none" : a.col}" stroke="${a.hollow ? a.col : "#000"}" stroke-opacity="${a.hollow ? 1 : 0.6}" stroke-width="4"/></svg><span class="eye-ac-l">${esc(a.label)}</span>`,
});
const clusterIcon = (n: number, col: string) => L.divIcon({ className: "eye-cl-w", iconSize: [42, 42], iconAnchor: [21, 21], html: `<div class="eye-cl" style="border-color:${col}"><b>${n}</b></div>` });

const COLS = 5, DX = 74, DY = 38, MERGE_PX = 46; // COLS is the maximum per row: the real count is reduced to what fits across the visible map
type Cl = { items: MapAc[]; px: L.Point; ll: L.LatLng };

// Real map. Aircraft are drawn one by one while they fit on screen; the ones that would overlap are merged into a numbered bubble
// (no fixed count: it depends on the zoom and the size of the map). Click a bubble to zoom in on it, or to list its flights when it can't be split.
export default function EyeMap({ rings, center, airportLabel, aircraft, hov, onHover, onOpen, fit }: { rings: Ring[]; center: [number, number]; airportLabel: string; aircraft: MapAc[]; hov: string | null; onHover: (id: string | null) => void; onOpen: (id: string) => void; fit: [number, number][] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const stat = useRef<L.LayerGroup | null>(null);
  const acl = useRef<L.LayerGroup | null>(null);
  const els = useRef(new Map<string, L.Marker>());
  const cb = useRef({ onHover, onOpen }); cb.current = { onHover, onOpen };
  const live = useRef({ aircraft, center, hov }); live.current = { aircraft, center, hov };

  const popup = (ll: L.LatLng, items: MapAc[]) => {
    const m = map.current; if (!m) return;
    const box = document.createElement("div"); box.className = "eye-pop";
    items.forEach((a) => { const b = document.createElement("button"); b.type = "button"; b.className = "eye-pop-i"; const t = document.createElement("b"); t.textContent = a.label; b.appendChild(t); if (a.sub) { const s = document.createElement("small"); s.textContent = a.sub; b.appendChild(s); } b.onclick = () => cb.current.onOpen(a.id); box.appendChild(b); });
    L.popup({ className: "eye-pop-w", closeButton: true, maxHeight: 260 }).setLatLng(ll).setContent(box).openOn(m);
  };

  const draw = () => {
    const m = map.current, g = acl.current; if (!m || !g) return;
    const { aircraft: list, center: c } = live.current;
    g.clearLayers(); els.current.clear();
    const size = m.getSize(), pin = m.latLngToContainerPoint(c), pinLP = m.latLngToLayerPoint(c);
    const single = (a: MapAc, ll: L.LatLng) => {
      const mk = L.marker(ll, { icon: planeIcon(a), keyboard: true, title: a.label, riseOnHover: true }).addTo(g);
      mk.on("mouseover", () => cb.current.onHover(a.id)).on("mouseout", () => cb.current.onHover(null)).on("click", () => cb.current.onOpen(a.id));
      els.current.set(a.id, mk);
    };
    const bubble = (items: MapAc[], ll: L.LatLng, zoomable: boolean) => {
      const cols = [...new Set(items.map((i) => i.col))];
      const mk = L.marker(ll, { icon: clusterIcon(items.length, cols.length === 1 ? cols[0] : "#FFC107"), keyboard: true, title: String(items.length), zIndexOffset: 500 }).addTo(g);
      mk.on("click", () => { if (zoomable && m.getZoom() < 12) m.fitBounds(L.latLngBounds(items.map((i) => L.latLng(i.ll as [number, number]))), { padding: [100, 100], maxZoom: 12 }); else popup(ll, items); });
      els.current.set(`cl:${items.map((i) => i.id).join(",")}`, mk);
    };
    // at the airport: a grid if it fits in the visible map, otherwise one bubble
    (["down", "up"] as const).forEach((grp) => {
      const items = list.filter((a) => a.grp === grp); if (!items.length) return;
      const avail = grp === "down" ? size.y - pin.y - 44 - 36 : pin.y - 48 - 24;
      const cols = Math.max(1, Math.min(COLS, Math.floor((2 * Math.min(pin.x, size.x - pin.x) - 24) / DX)));
      const cap = Math.max(0, Math.floor(avail / DY)) * cols;
      const at = (dx: number, dy: number) => m.layerPointToLatLng(pinLP.add(L.point(dx, dy)));
      if (items.length <= cap) items.forEach((a, i) => { const col = i % cols, row = Math.floor(i / cols); single(a, at((col - (Math.min(items.length, cols) - 1) / 2) * DX, grp === "down" ? 44 + row * DY : -48 - row * DY)); });
      else bubble(items, at(0, grp === "down" ? 44 : -48), false);
    });
    // everything else: merge by screen distance
    const cls: Cl[] = [];
    list.filter((a) => a.ll).forEach((a) => {
      const ll = L.latLng(a.ll as [number, number]), px = m.latLngToContainerPoint(ll);
      const hit = cls.find((k) => k.px.distanceTo(px) < MERGE_PX);
      if (hit) { hit.items.push(a); const n = hit.items.length; hit.px = L.point((hit.px.x * (n - 1) + px.x) / n, (hit.px.y * (n - 1) + px.y) / n); hit.ll = L.latLng((hit.ll.lat * (n - 1) + ll.lat) / n, (hit.ll.lng * (n - 1) + ll.lng) / n); }
      else cls.push({ items: [a], px, ll });
    });
    cls.forEach((k) => (k.items.length === 1 ? single(k.items[0], k.ll) : bubble(k.items, k.ll, true)));
    mark();
  };
  const mark = () => { const h = live.current.hov; els.current.forEach((mk, key) => mk.getElement()?.classList.toggle("on", !!h && (key === h || (key.startsWith("cl:") && key.slice(3).split(",").includes(h))))); };

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: live.current.center, zoom: 9, zoomControl: false, attributionControl: false, worldCopyJump: true });
    L.control.attribution({ prefix: false }).addTo(m);
    L.control.zoom({ position: "topright" }).addTo(m);
    // Esri dark-gray basemap: needs no API key. Labels come from the reference layer on top.
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, attribution: "Tiles © Esri — Esri, HERE, Garmin, OpenStreetMap contributors" }).addTo(m);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(m);
    stat.current = L.layerGroup().addTo(m); acl.current = L.layerGroup().addTo(m);
    map.current = m;
    m.on("zoomend moveend resize", draw);
    return () => { m.remove(); map.current = null; els.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // static radar overlay: time rings, sweep arm, airport pin
  useEffect(() => {
    const g = stat.current; if (!g) return;
    g.clearLayers();
    L.marker(center, { icon: L.divIcon({ className: "eye-sweep", iconSize: [600, 600], iconAnchor: [300, 300], html: '<div class="eye-sweep-i"></div>' }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(g);
    rings.forEach((r, i) => {
      L.circle(center, { radius: r.km * 1000, color: i === rings.length - 1 ? "#8FB8FF" : "#FFC107", weight: 1, opacity: 0.55, dashArray: "6 6", fill: false, interactive: false }).addTo(g);
      L.marker([center[0] + r.km / 111.2, center[1]], { icon: L.divIcon({ className: "eye-ring-l", iconSize: [40, 14], iconAnchor: [20, 7], html: r.label }), interactive: false, keyboard: false }).addTo(g);
    });
    L.circleMarker(center, { radius: 6, color: "#FFC107", weight: 2, fillColor: "#FFC107", fillOpacity: 0.9 }).bindTooltip(airportLabel, { permanent: true, direction: "top", offset: [0, -8], className: "eye-apt" }).addTo(g);
  }, [center, airportLabel, rings]);

  // frame the airport and the approaching flights when the airport or the set of approaching flights changes
  useEffect(() => {
    const m = map.current; if (!m) return;
    const pts: [number, number][] = [center, ...fit];
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [90, 90], maxZoom: 9 }); else m.setView(center, 9);
  }, [center, fit]);

  useEffect(() => { draw(); }, [aircraft, center]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mark(); }, [hov]);

  return <div ref={el} className="eye-lf" />;
}
