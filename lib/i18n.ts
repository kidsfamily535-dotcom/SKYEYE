// Interface language (ar | en). Shared by server and client code, no React or Next imports.
// Scope: the UI only. Reply drafts stay English, codes and times stay English UTC (fixed project rules).
export type Lang = "ar" | "en";
export const LANGS: readonly Lang[] = ["ar", "en"];
export const DEFAULT_LANG: Lang = "ar";
export const LANG_COOKIE = "skyeye_lang";

export const isLang = (v: unknown): v is Lang => v === "ar" || v === "en";
export const dirOf = (l: Lang): "rtl" | "ltr" => (l === "ar" ? "rtl" : "ltr");

const ar = {
  "meta.title": "SKYEYE — عين العمليات الأرضية",
  "meta.description": "وكيل العمليات الأرضية",
  "lang.switchTo": "English",
  "lang.switchLabel": "تغيير اللغة إلى الإنجليزية",
  "nav.aria": "القائمة الرئيسية",
  "nav.home": "قيادتي",
  "nav.inbox": "الوارد والمسودات",
  "nav.flights": "الرحلات",
  "nav.agent": "كلّم الوكيل",
  "shell.handover": "تسليم الوردية",
  "shell.handoverPending": "تسليم الوردية: {n} بانتظار الاستلام",
  "shell.shadow": "وضع الظل · لا يُرسل شيء",
  "shell.signout": "خروج",
  "menu.more": "المزيد",
  "login.intro": "سجّل دخولك بحسابك الخاص. كل حساب تابع لشركة واحدة.",
  "login.email": "البريد الإلكتروني",
  "login.password": "كلمة المرور",
  "login.error": "البريد أو كلمة المرور غير صحيحين.",
  "login.submit": "دخول",
  "login.busy": "جارٍ الدخول…",
} as const;

export type Key = keyof typeof ar;

const en: Record<Key, string> = {
  "meta.title": "SKYEYE — ground operations eye",
  "meta.description": "Ground operations agent",
  "lang.switchTo": "العربية",
  "lang.switchLabel": "Switch language to Arabic",
  "nav.aria": "Main menu",
  "nav.home": "My command",
  "nav.inbox": "Inbox & drafts",
  "nav.flights": "Flights",
  "nav.agent": "Talk to the agent",
  "shell.handover": "Shift handover",
  "shell.handoverPending": "Shift handover: {n} awaiting acceptance",
  "shell.shadow": "Shadow mode · nothing is sent",
  "shell.signout": "Sign out",
  "menu.more": "More",
  "login.intro": "Sign in with your own account. Each account belongs to one company.",
  "login.email": "Email",
  "login.password": "Password",
  "login.error": "Wrong email or password.",
  "login.submit": "Sign in",
  "login.busy": "Signing in…",
};

export const dict: Record<Lang, Record<Key, string>> = { ar, en };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s = dict[lang][key] ?? dict[DEFAULT_LANG][key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
