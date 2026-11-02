"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LANG_COOKIE, isLang } from "@/lib/i18n";

const cookieOpts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

/** Save the chosen UI language in a cookie, and on the account (memberships.preferred_language) when signed in. */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, cookieOpts);
  try { await (await createClient()).rpc("set_my_language", { p_lang: lang }); } catch { /* signed out (login page): the cookie is enough */ }
  revalidatePath("/", "layout");
}

/** After sign-in: a language picked on the login screen wins and is saved; otherwise adopt the saved account language. */
export async function syncLanguageAfterLogin() {
  const store = await cookies();
  const supabase = await createClient();
  const chosen = store.get(LANG_COOKIE)?.value;
  if (isLang(chosen)) { await supabase.rpc("set_my_language", { p_lang: chosen }); return; }
  const { data } = await supabase.rpc("get_my_language");
  if (isLang(data)) store.set(LANG_COOKIE, data, cookieOpts);
}
