"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLanguage } from "@/app/lang-actions";
import { useT } from "./I18n";

export default function LangSwitch() {
  const { lang, t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button type="button" className="btn ghost sm" disabled={pending} lang={next} aria-label={t("lang.switchLabel")}
      onClick={() => start(async () => { await setLanguage(next); router.refresh(); })}>
      {t("lang.switchTo")}
    </button>
  );
}
