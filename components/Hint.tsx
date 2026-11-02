"use client";
import type { ReactNode } from "react";
import { useT } from "./I18n";

/** Short explanation behind a small "؟" button, instead of a permanent paragraph. No JS needed. */
export default function Hint({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <details className="hint">
      <summary aria-label={t("hint.aria")}>{t("hint.mark")}</summary>
      <span role="note">{children}</span>
    </details>
  );
}
