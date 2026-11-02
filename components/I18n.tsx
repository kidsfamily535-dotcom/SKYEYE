"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translate, type Key, type Lang } from "@/lib/i18n";

const Ctx = createContext<Lang>("ar");

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

/** Client side translator: const { t, lang } = useT(); */
export function useT() {
  const lang = useContext(Ctx);
  return useMemo(() => ({ lang, t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars) }), [lang]);
}
