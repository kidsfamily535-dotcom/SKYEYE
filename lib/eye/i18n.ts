import type { Lang } from "@/lib/i18n";

// Small own dictionary so the airline portal does not touch the SKYEYE translation file.
const D = {
  ar: {
    brand: "عين الشركة", brandSub: "AIRLINE EYE", signout: "خروج", lang: "English",
    loginIntro: "ادخل بحساب شركة الطيران لمتابعة طائراتك على الأرض.", email: "الإيميل", password: "كلمة السر",
    loginBtn: "دخول", loginBusy: "جاري الدخول…", loginErr: "الإيميل أو كلمة السر غير صحيحة.",
    noAccessTitle: "الحساب ده مش مربوط بشركة طيران", noAccessBody: "اطلب من مدير شركتك يدعوك بنفس الإيميل، وبعدها ادخل تاني.",
    flights: "الرحلات", flightsSub: "كل رحلة في صف: الوصول والسفر منفصلين. اضغط على أي رحلة لتشوف الطيارة على الوقفة.",
    arrival: "وصول", departure: "سفر", utc: "UTC", reg: "التسجيل", leavesAs: "تغادر برحلة", cameAs: "وصلت برحلة",
    onStand: "على الوقفة من", today: "النهاردة وبعده", earlier: "رحلات سابقة", noFlights: "مفيش رحلات ظاهرة دلوقتي.", noEarlier: "مفيش رحلات سابقة في آخر 7 أيام.",
    station: "المحطة", allStations: "كل المحطات", workspace: "مساحة العمل",
    cov_stopped: "المحطة متوقفة حاليًا", cov_pending_link: "المحطة لسه مش مربوطة بشركة المناولة",
    back: "رجوع للرحلات", viewOnly: "مشاهدة فقط", turnErr: "المشهد مش متاح: الرحلة مش تابعة لمساحة العمل دي أو اتغيّرت.",
    listErr: "ما قدرناش نحمّل الرحلات. جرّب تحدّث الصفحة.", loadMore: "",
  },
  en: {
    brand: "Airline Eye", brandSub: "AIRLINE EYE", signout: "Sign out", lang: "العربية",
    loginIntro: "Sign in with your airline account to follow your aircraft on the ground.", email: "Email", password: "Password",
    loginBtn: "Sign in", loginBusy: "Signing in…", loginErr: "Wrong email or password.",
    noAccessTitle: "This account is not linked to an airline", noAccessBody: "Ask your airline administrator to invite this exact email, then sign in again.",
    flights: "Flights", flightsSub: "One row per flight: arrival and departure are separate. Tap a flight to see the aircraft on its stand.",
    arrival: "Arrival", departure: "Departure", utc: "UTC", reg: "Registration", leavesAs: "departs as", cameAs: "arrived as",
    onStand: "On stand since", today: "Today and later", earlier: "Earlier flights", noFlights: "No flights to show right now.", noEarlier: "No earlier flights in the last 7 days.",
    station: "Station", allStations: "All stations", workspace: "Workspace",
    cov_stopped: "This station is currently stopped", cov_pending_link: "This station is not yet linked to the handling company",
    back: "Back to flights", viewOnly: "View only", turnErr: "This view is not available: the flight is not part of this workspace or has changed.",
    listErr: "Could not load the flights. Try refreshing the page.", loadMore: "",
  },
} as const;

export type EyeKey = keyof (typeof D)["ar"];
export const eyeText = (lang: Lang) => (k: EyeKey): string => D[lang][k];
