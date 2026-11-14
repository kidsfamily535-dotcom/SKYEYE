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
    sceneAria: "مشهد الطيارة على الوقفة", stageAria: "الخدمات حوالين الطيارة. اضغط على أي خدمة للتفاصيل.", stripAria: "شريط الوقت على الأرض", close: "إغلاق",
    toArrive: "الطيارة في الطريق", sta: "الوصول المخطط", onStandNow: "على الوقفة", unitLeft: "دقيقة باقية في زمن الوقفة", unitOver: "دقيقة فوق الزمن المخطط", noData: "لسه مفيش بيانات كفاية",
    calmOk: "الأمور ماشية في معادها.", calmSoon: "فيه احتمال تأخير بسيط عن موعد الإقلاع.", calmOver: "الوقفة أخدت وقت أطول من المخطط.",
    tagDone: "اكتملت في موعدها", tagLate: "اكتملت بعد الموعد", tagRunning: "جارية الآن", tagUpcoming: "لسه ما بدأتش", tagWaiting: "بانتظار تحديث من فريق الأرض",
    dPlanned: "النهاية المخططة", dExpected: "النهاية المتوقعة", dActual: "النهاية الفعلية", dStarted: "بدأت", dReason: "السبب", dNoReason: "لم يُذكر سبب لهذا التأخير.",
    logTitle: "سجل الإقلاع", logOnTime: "أقلعت في موعدها", logDelayed: "أقلعت بعد الموعد المخطط بـ {n} دقيقة", logPlain: "غادرت الوقفة", logSub: "ملخص ما حدث على الأرض",
    logOnStand: "وصلت الوقفة", logPlannedDep: "الإقلاع المخطط", logOffBlock: "غادرت الوقفة فعليًا", logWhat: "اللي أثّر على الوقت", logNoDelays: "لم تُسجَّل أسباب تأخير.", logMin: "{n} د",
    emptyTitle: "مفيش طيارات على الأرض دلوقتي", emptyBody: "أول ما طيارة تبدأ وقفتها هتظهر هنا لوحدها، ومش محتاج تعمل حاجة.",
    errTitle: "حصلت مشكلة صغيرة", errBody: "ما قدرناش نعرض الصفحة دلوقتي. بياناتك سليمة، جرّب تاني.", retry: "حاول تاني", loading: "جاري التحميل…",
    offline: "الاتصال بالإنترنت انقطع. اللي قدامك آخر ما اتحمّل، وهيتحدّث لما يرجع.", online: "رجع الاتصال.",
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
    sceneAria: "Aircraft on its stand", stageAria: "Services around the aircraft. Tap one for details.", stripAria: "Time on the ground", close: "Close",
    toArrive: "The aircraft is on its way", sta: "Planned arrival", onStandNow: "On the stand", unitLeft: "min left of the planned stand time", unitOver: "min over the planned time", noData: "Not enough data yet",
    calmOk: "Everything is on schedule.", calmSoon: "A small delay to the departure time is possible.", calmOver: "The stand time is running longer than planned.",
    tagDone: "Completed on time", tagLate: "Completed after plan", tagRunning: "In progress", tagUpcoming: "Not started yet", tagWaiting: "Waiting for an update from the ground team",
    dPlanned: "Planned end", dExpected: "Expected end", dActual: "Actual end", dStarted: "Started", dReason: "Reason", dNoReason: "No reason was given for this delay.",
    logTitle: "Departure log", logOnTime: "Departed on time", logDelayed: "Departed {n} min after the planned time", logPlain: "Left the stand", logSub: "A summary of what happened on the ground",
    logOnStand: "Arrived on stand", logPlannedDep: "Planned departure", logOffBlock: "Actually left the stand", logWhat: "What affected the time", logNoDelays: "No delay reasons were recorded.", logMin: "{n} min",
    emptyTitle: "No aircraft on the ground right now", emptyBody: "As soon as an aircraft starts its stand time it will appear here by itself. You don't need to do anything.",
    errTitle: "A small problem came up", errBody: "We could not show this page right now. Your data is safe, please try again.", retry: "Try again", loading: "Loading…",
    offline: "You are offline. What you see is the last loaded view, and it will refresh when the connection returns.", online: "Back online.",
  },
} as const;

export type EyeKey = keyof (typeof D)["ar"];
export const eyeText = (lang: Lang) => (k: EyeKey): string => D[lang][k];
