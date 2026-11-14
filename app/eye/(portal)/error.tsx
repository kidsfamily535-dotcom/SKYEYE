"use client";
import { useT } from "@/components/I18n";
import { eyeText } from "@/lib/eye/i18n";

// Friendly error screen for anything that throws while rendering the portal. It shows no technical detail.
export default function EyeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useT();
  const t = eyeText(lang);
  return (
    <section className="eye-empty-card" role="alert">
      <h2>{t("errTitle")}</h2>
      <p>{t("errBody")}</p>
      <button type="button" className="btn gold" onClick={reset}>{t("retry")}</button>
    </section>
  );
}
