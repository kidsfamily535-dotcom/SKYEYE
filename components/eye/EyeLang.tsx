"use client";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

// Language switch for the airline portal. Cookie only: it does not call the SKYEYE account-language function.
export default function EyeLang({ lang, label }: { lang: Lang; label: string }) {
  const router = useRouter();
  const next: Lang = lang === "ar" ? "en" : "ar";
  return (
    <button type="button" className="btn ghost sm" lang={next} onClick={() => { document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }}>
      {label}
    </button>
  );
}
