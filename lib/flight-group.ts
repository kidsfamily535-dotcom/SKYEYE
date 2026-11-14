const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Dates stay English and UTC (fixed rule): "Fri 04 Nov". */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
}
/** Short date for a card time: "04 Nov". */
export const dayShort = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)} ${MON[Number(iso.slice(5, 7)) - 1]}` : "");

/** Planned ground minutes (STD minus STA of the same turnaround). Only when both exist and it is not negative. */
export function plannedGround(r: { sta: string | null; std: string | null }): number | null {
  if (!r.sta || !r.std) return null;
  const m = Math.round((+new Date(r.std) - +new Date(r.sta)) / 60000);
  return m >= 0 ? m : null;
}
