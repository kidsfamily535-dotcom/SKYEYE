"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export type MapAc = { id: string; label: string; col: string; heading: number; hollow: boolean; ll?: [number, number]; off?: [number, number] };
const PL = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";
const icon = (a: MapAc) => L.divIcon({
  className: "eye-ac", iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<svg viewBox="-40 -38 80 80" width="30" height="30" style="transform:rotate(${a.heading}deg)"><path d="${PL}" fill="${a.hollow ? "none" : a.col}" stroke="${a.hollow ? a.col : "#000"}" stroke-opacity="${a.hollow ? 1 : 0.6}" stroke-width="4"/></svg><span class="eye-ac-l">${a.label.replace(/[<>&"]/g, "")}</span>`,
});

// Real map (OpenStreetMap data, CARTO dark tiles). Aircraft on the ground sit in a fixed pixel grid around the airport pin so they never overlap when zoomed out.
export type Ring = { km: number; label: string };
export default function EyeMap({ rings, center, airportLabel, aircraft, hov, onHover, onOpen, fit }: { rings: Ring[]; center: [number, number]; airportLabel: string; aircraft: MapAc[]; hov: string | null; onHover: (id: string | null) => void; onOpen: (id: string) => void; fit: [number, number][] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, { m: L.Marker; a: MapAc }>());
  const cb = useRef({ onHover, onOpen }); cb.current = { onHover, onOpen };

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center, zoom: 9, zoomControl: false, attributionControl: false, worldCopyJump: true });
    L.control.attribution({ prefix: false }).addTo(m);
    L.control.zoom({ position: "topright" }).addTo(m);
    // Esri dark-gray basemap: needs no API key. Labels come from the reference layer on top.
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, attribution: "Tiles © Esri — Esri, HERE, Garmin, OpenStreetMap contributors" }).addTo(m);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const reposition = () => markers.current.forEach(({ m: mk, a }) => { if (a.off) { const p = m.latLngToLayerPoint(center).add(L.point(a.off[0], a.off[1])); mk.setLatLng(m.layerPointToLatLng(p)); } });
    m.on("zoomend", reposition);
    return () => { m.remove(); map.current = null; markers.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers(); markers.current.clear();
    // Radar overlay: time rings (distance = minutes to arrival) and a rotating sweep arm, both centred on the airport.
    L.marker(center, { icon: L.divIcon({ className: "eye-sweep", iconSize: [600, 600], iconAnchor: [300, 300], html: '<div class="eye-sweep-i"></div>' }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(g);
    rings.forEach((r, i) => {
      L.circle(center, { radius: r.km * 1000, color: i === rings.length - 1 ? "#8FB8FF" : "#FFC107", weight: 1, opacity: 0.55, dashArray: "6 6", fill: false, interactive: false }).addTo(g);
      L.marker([center[0] + r.km / 111.2, center[1]], { icon: L.divIcon({ className: "eye-ring-l", iconSize: [40, 14], iconAnchor: [20, 7], html: r.label }), interactive: false, keyboard: false }).addTo(g);
    });
    L.circleMarker(center, { radius: 6, color: "#FFC107", weight: 2, fillColor: "#FFC107", fillOpacity: 0.9 }).bindTooltip(airportLabel, { permanent: true, direction: "top", offset: [0, -8], className: "eye-apt" }).addTo(g);
    aircraft.forEach((a) => {
      const ll = a.off ? m.layerPointToLatLng(m.latLngToLayerPoint(center).add(L.point(a.off[0], a.off[1]))) : L.latLng(a.ll as [number, number]);
      const mk = L.marker(ll, { icon: icon(a), keyboard: true, title: a.label, riseOnHover: true }).addTo(g);
      mk.on("mouseover", () => cb.current.onHover(a.id)).on("mouseout", () => cb.current.onHover(null)).on("click", () => cb.current.onOpen(a.id));
      markers.current.set(a.id, { m: mk, a });
    });
    const pts = [center, ...fit];
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [90, 90], maxZoom: 9 }); else m.setView(center, 9);
  }, [center, airportLabel, aircraft, fit, rings]);

  useEffect(() => { markers.current.forEach(({ m }, id) => m.getElement()?.classList.toggle("on", id === hov)); }, [hov, aircraft]);

  return <div ref={el} className="eye-lf" />;
}
