import type { Lang } from "@/lib/i18n";

// Shared constants for the apron scene (components/ApronStand.tsx), used by the SKYEYE flight file and by Airline Eye.
// Layout is authored for a 520 x 340 map, aircraft nose up, centred in its dashed stand box.

export const MAP_W = 520;
export const MAP_H = 340;
export const CX = 260;
export const CY = 155;
export const BOX = { x: 188, y: 72, w: 144, h: 166 };
export const TAXI_Y = 267;

/** Top-down aircraft outline (nose up, about 76 x 68 units). */
export const PLANE = "M0,-34L4,-10L38,6L38,12L4,6L3,24L12,30L12,34L0,31L-12,34L-12,30L-3,24L-4,6L-38,12L-38,6L-4,-10Z";

export type VehKind = "bus" | "bags" | "clean" | "cater" | "fuel";
export const VEH_COLOR: Record<VehKind, string> = { bus: "#4C8DFF", bags: "#B18CFF", clean: "#35C2C2", cater: "#FF8A5B", fuel: "#E9E9E9" };

/** Which vehicle serves which step, and where it stands relative to the aircraft centre. Steps not listed here (doors, off-block) have no vehicle. */
const VEH: Record<string, { kind: VehKind; dx: number; dy: number }> = {
  deboard: { kind: "bus", dx: -52, dy: -54 },
  boarding: { kind: "bus", dx: -52, dy: -54 },
  bags_unload: { kind: "bags", dx: 50, dy: 52 },
  bags_load: { kind: "bags", dx: 50, dy: 52 },
  cleaning: { kind: "clean", dx: -36, dy: 64 },
  catering: { kind: "cater", dx: -60, dy: 24 },
  fuel: { kind: "fuel", dx: 66, dy: -8 },
};
export const vehOf = (code: string) => (code.startsWith("boarding") ? VEH.boarding : VEH[code] ?? null);

/** Airline lane view: the aircraft lies along the runway line (nose left), so the vehicles stand above and below it instead. */
const VEH_LANE: Record<string, { kind: VehKind; dx: number; dy: number }> = {
  deboard: { kind: "bus", dx: -50, dy: -50 },
  boarding: { kind: "bus", dx: -50, dy: -50 },
  cleaning: { kind: "clean", dx: -14, dy: -52 },
  bags_unload: { kind: "bags", dx: 24, dy: -50 },
  bags_load: { kind: "bags", dx: 24, dy: -50 },
  fuel: { kind: "fuel", dx: -6, dy: 48 },
  catering: { kind: "cater", dx: 62, dy: 30 },
};
export const vehOfLane = (code: string) => (code.startsWith("boarding") ? VEH_LANE.boarding : VEH_LANE[code] ?? null);

const GANTT: Record<string, string> = { deboard: "#4C8DFF", boarding: "#4C8DFF", bags_unload: "#B18CFF", bags_load: "#B18CFF", cleaning: "#35C2C2", catering: "#FF8A5B", fuel: "#E9E9E9", doors_closed: "#8A97A6", off_block: "#8A97A6" };
export const colorOf = (code: string) => (code.startsWith("boarding") ? GANTT.boarding : GANTT[code] ?? "#A3A3A3");

const D = {
  ar: {
    terminal: "المبنى", stand: "الموقف", taxiway: "ممر الطائرات", road: "طريق الخدمة", depot: "مستودع المعدات",
    inbound: "قادمة", left: "غادرت الموقف", sta: "الوصول المخطط",
    mapAria: "خريطة الوقفة: الطائرة داخل موقفها والخدمات حولها", mapNote: "مواضع المركبات تعبّر عن حالة الخدمة وليست تتبعًا بالـGPS.",
    gantt: "الخط الزمني للخدمات", ganttAria: "الخط الزمني للخدمات", legend: "متقطع = المخطط · مصمت = المسجَّل", legendBad: "أحمر = تجاوز", legendCalm: "كهرماني = تجاوز",
    std: "الإقلاع المخطط", dep: "إقلاع", now: "الآن", onTime: "في الوقت", min: "د",
    services: "الخدمات", delays: "تأخيرات الخدمات", noDelays: "لا تأخيرات حاليًا.", log: "سجل الوقفة", noLog: "لا أحداث مسجّلة بعد.",
    planned: "المخطط", actual: "الفعلي", expected: "المتوقع", started: "بدأت", reason: "السبب", noReason: "لم يُذكر سبب بعد.", fixed: "مصحَّح",
    lateStart: "تأخر البدء", over: "تجاوزت المخطط", close: "إغلاق", zoomIn: "تكبير", zoomOut: "تصغير", zoomReset: "إعادة الضبط",
  },
  en: {
    terminal: "Terminal", stand: "Stand", taxiway: "Taxiway", road: "Service road", depot: "Equipment depot",
    inbound: "Inbound", left: "Left the stand", sta: "Planned arrival",
    mapAria: "Stand map: the aircraft in its stand with its services around it", mapNote: "Vehicle positions show service state, not GPS tracking.",
    gantt: "Service timeline", ganttAria: "Service timeline", legend: "Dashed = planned · solid = recorded", legendBad: "red = over plan", legendCalm: "amber = over plan",
    std: "Planned departure", dep: "Departure", now: "Now", onTime: "on time", min: "m",
    services: "Services", delays: "Service delays", noDelays: "No delays right now.", log: "Stand log", noLog: "No events recorded yet.",
    planned: "Planned", actual: "Actual", expected: "Expected", started: "Started", reason: "Reason", noReason: "No reason stated yet.", fixed: "corrected",
    lateStart: "Late start", over: "Past plan", close: "Close", zoomIn: "Zoom in", zoomOut: "Zoom out", zoomReset: "Reset view",
  },
} as const;
export type ApronKey = keyof (typeof D)["ar"];
export const apronText = (lang: Lang) => (k: ApronKey): string => D[lang][k];
