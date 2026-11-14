import type { Lang } from "@/lib/i18n";

/** Human duration in the UI language, no Latin letters inside Arabic text: "ساعة و9 دقائق", "2h 05m". */
export function durText(min: number, lang: Lang): string {
  const a = Math.max(0, Math.abs(Math.round(min)));
  const days = Math.floor(a / 1440);
  const h = Math.floor((a % 1440) / 60);
  const m = a % 60;
  if (lang === "en") {
    if (days) return `${days}d${h ? ` ${h}h` : ""}`;
    return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}` : `${m}m`;
  }
  const unit = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
  if (days) return [unit(days, "يوم", "يومان", "أيام", "يوماً"), h ? unit(h, "ساعة", "ساعتان", "ساعات", "ساعة") : ""].filter(Boolean).join(" و");
  const hp = h ? unit(h, "ساعة", "ساعتان", "ساعات", "ساعة") : "";
  const mp = m ? unit(m, "دقيقة", "دقيقتان", "دقائق", "دقيقة") : "";
  return hp && mp ? `${hp} و${mp}` : hp || mp || "0 دقيقة";
}
