/**
 * Every Arabic display label lives here, grouped by screen. Client-safe (no server imports).
 * Codes, times and numbers stay English/UTC (fixed rule); only words are translated.
 */

/* ---- Inbox ---- */
export const CATEGORY_AR: Record<string, string> = {
  mvt: "رسالة حركة", load_message: "رسالة حمولة", schedule: "جدول رحلات", service_request: "طلب خدمة", slot: "سلوت",
  permit: "تصريح", finance: "مالية", complaint: "شكوى", general: "عام", unknown: "غير مصنّف",
};
export const URGENCY_AR: Record<string, string> = { normal: "عادي", important: "مهم", urgent: "عاجل" };
export const INBOX_STATUS_AR: Record<string, string> = { new: "جديد", reviewed: "تمت المراجعة", replied: "تم الرد", no_reply_needed: "لا يحتاج رداً", dismissed: "مستبعد" };

/* ---- Request files ---- */
export const WAITING_AR: Record<string, string> = { employee: "الموظف", permits_dept: "قسم التصاريح", authority: "السلطة المدنية", airline: "شركة الطيران", none: "—" };
export const ACTOR_AR: Record<string, string> = { employee: "موظف", agent: "الوكيل", system: "النظام" };
export const TYPE_AR: Record<string, string> = { permit: "تصريح" };
export const POLICY_AR: Record<string, string> = { warn_before_hours: "تنبيه قبل موعد الطلب", urgent_hours: "ما يُعدّ عاجلاً قبل الرحلة", lead_time_hours: "المهلة الطبيعية قبل الرحلة", stall_after_hours: "الطلب الراكد بعد" };
export const REQUEST_ALERT_KIND_AR = { overdue: "متأخر", due: "اقترب موعده", stalled: "راكد" } as const;

/* ---- Flights ---- */
export const FLIGHT_STATUS_AR: Record<string, string> = { scheduled: "مجدولة", delayed: "متأخرة", arrived: "وصلت", departed: "غادرت", cancelled: "ملغاة", diverted: "محوّلة" };
export const TRACK_AR: Record<string, string> = {
  RAMP_ARRIVAL: "الرامب عند الوصول", PAX_ARRIVAL: "الركاب عند الوصول", BAG_ARRIVAL: "الحقائب عند الوصول", CARGO_ARRIVAL: "الشحن عند الوصول",
  SERVICING: "التجهيز والخدمة", PAX_DEPARTURE: "الركاب عند المغادرة", CARGO_DEPARTURE: "الشحن عند المغادرة", LOAD_CONTROL: "الوزن والتوازن", DEPARTURE: "المغادرة",
};

/* ---- Shift handover ---- */
export const QUESTION_STATUS_AR: Record<string, string> = { asked: "مطروح", in_progress: "قيد المتابعة", late: "متأخر", escalated: "مُصعَّد" };
export const ALERT_STATUS_AR: Record<string, string> = { open: "جديد", acknowledged: "تمت رؤيته" };

/* ---- Agent chat ---- */
export const CMD_AR: Record<string, string> = {
  answer_question: "سؤال للوكيل", employee_info: "معلومة من الموظف", redraft_reply: "أعد صياغة المسودة", retriage_email: "أعد تصنيف الإيميل",
  open_permit_files: "افتح ملفات التصاريح", link_email_to_request: "اربط الإيميل بملف طلب", rebuild_history: "أعد بناء التاريخ", prepare_followup: "جهّز متابعة", reread_attachment: "أعد قراءة المرفق",
};
export const AGENT_STATUS_AR: Record<string, string> = { queued: "بانتظار الوكيل", running: "الوكيل يعمل عليه", done: "تم", failed: "فشل", cancelled: "أُلغي" };
export const AGENT_TARGET_AR: Record<string, string> = { email_message: "إيميل", reply_draft: "مسودة رد", request_file: "ملف طلب", flight: "رحلة", email_triage: "تصنيف إيميل", permit: "تصريح", exception: "تنبيه", attachment: "مرفق" };
export type Opt = { id: string; label: string };

/* ---- Users ---- */
export const ROLE_AR: Record<string, string> = { owner: "مالك", admin: "مدير", operator: "موظف عمليات", viewer: "مشاهد" };

/* ---- Tag tones (shared by every status chip) ---- */
export type Tone = "late" | "warn" | "info" | "ok";
export const urgencyTone = (u: string | null): Tone => (u === "urgent" ? "late" : u === "important" ? "warn" : "info");
export const AGENT_STATUS_TONE: Record<string, Tone> = { queued: "warn", running: "info", done: "ok", failed: "late", cancelled: "info" };
