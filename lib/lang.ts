import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isLang, translate, type Key, type Lang } from "./i18n";

/** Server side: current UI language from the cookie (default Arabic). */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : DEFAULT_LANG;
}

/** Server side translator: const { t, lang } = await getT(); */
export async function getT() {
  const lang = await getLang();
  return { lang, t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars) };
}
