import type { Lang } from "@/lib/i18n";

/** Step name in the interface language (safe for client components). English falls back to Arabic when the database has no English name. */
export const stepName = (s: { nameAr: string; nameEn?: string | null }, lang: Lang) => (lang === "en" ? s.nameEn || s.nameAr : s.nameAr);
