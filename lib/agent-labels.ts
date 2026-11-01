export const CMD_AR: Record<string, string> = {
  answer_question: "سؤال للوكيل", employee_info: "معلومة من الموظف", redraft_reply: "أعد صياغة المسودة", retriage_email: "أعد تصنيف الإيميل",
  open_permit_files: "افتح ملفات التصاريح", link_email_to_request: "اربط الإيميل بملف طلب", rebuild_history: "أعد بناء التاريخ", prepare_followup: "جهّز متابعة", reread_attachment: "أعد قراءة المرفق",
};
export const STATUS_AR: Record<string, string> = { queued: "بانتظار الوكيل", running: "الوكيل يعمل عليه", done: "تم", failed: "فشل", cancelled: "أُلغي" };
export const TARGET_AR: Record<string, string> = { email_message: "إيميل", reply_draft: "مسودة رد", request_file: "ملف طلب", flight: "رحلة", email_triage: "تصنيف إيميل", permit: "تصريح", exception: "تنبيه", attachment: "مرفق" };

/** Which commands make sense for each kind of target (the database enforces the same pairing). */
export const CMDS_BY_TARGET: Record<string, string[]> = {
  email_message: ["answer_question", "retriage_email", "open_permit_files", "link_email_to_request", "rebuild_history", "employee_info"],
  reply_draft: ["redraft_reply", "answer_question"],
  request_file: ["answer_question", "prepare_followup", "employee_info"],
  flight: ["answer_question", "prepare_followup", "employee_info"],
};
export const NEEDS_TEXT = new Set(["answer_question", "employee_info"]);

export type Opt = { id: string; label: string };
