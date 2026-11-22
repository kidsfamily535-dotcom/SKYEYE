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
export default function EyeMap({ center, airportLabel, aircraft, hov, onHover, onOpen, fit }: { center: [number, number]; airportLabel: string; aircraft: MapAc[]; hov: string | null; onHover: (id: string | null) => void; onOpen: (id: string) => void; fit: [number, number][] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, { m: L.Marker; a: MapAc }>());
  const cb = useRef({ onHover, onOpen }); cb.current = { onHover, onOpen };

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center, zoom: 9, zoomControl: true, attributionControl: true, worldCopyJump: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 18, attribution: "© OpenStreetMap contributors © CARTO" }).addTo(m);
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
    L.circleMarker(center, { radius: 6, color: "#FFC107", weight: 2, fillColor: "#FFC107", fillOpacity: 0.9 }).bindTooltip(airportLabel, { permanent: true, direction: "top", offset: [0, -8], className: "eye-apt" }).addTo(g);
    aircraft.forEach((a) => {
      const ll = a.off ? m.layerPointToLatLng(m.latLngToLayerPoint(center).add(L.point(a.off[0], a.off[1]))) : L.latLng(a.ll as [number, number]);
      const mk = L.marker(ll, { icon: icon(a), keyboard: true, title: a.label, riseOnHover: true }).addTo(g);
      mk.on("mouseover", () => cb.current.onHover(a.id)).on("mouseout", () => cb.current.onHover(null)).on("click", () => cb.current.onOpen(a.id));
      markers.current.set(a.id, { m: mk, a });
    });
    const pts = [center, ...fit];
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [90, 90], maxZoom: 9 }); else m.setView(center, 9);
  }, [center, airportLabel, aircraft, fit]);

  useEffect(() => { markers.current.forEach(({ m }, id) => m.getElement()?.classList.toggle("on", id === hov)); }, [hov, aircraft]);

  return <div ref={el} className="eye-lf" />;
}
