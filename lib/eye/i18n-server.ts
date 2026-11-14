import { getLang } from "@/lib/lang";
import { eyeText } from "./i18n";

/** Server side: const { t, lang } = await eyeT(); */
export async function eyeT() { const lang = await getLang(); return { lang, t: eyeText(lang) }; }
