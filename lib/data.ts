// Data contract for the Command screen. Session 2 replaces the sample source with Supabase queries
// (always scoped to the signed-in user's company by RLS). Numbers are null until real data exists.
export type Tone = "late" | "warn" | "info" | "ok";
export type Decision = { id: string; tone: Tone; text: string; action: string };
export type ActiveRequest = { id: string; airline: string; title: string; status: string; tone: Tone; next: string };
export type RadarCounts = { onGround: number | null; inbound: number | null; delayed: number | null; awaitingMsg: number | null };
export type CommandData = {
  isSample: boolean;
  company: { name: string; kind: string };
  user: { name: string; role: string };
  shadowMode: boolean;
  counts: { inboxToReview: number | null; draftsWaiting: number | null; urgentAlerts: number | null };
  radar: RadarCounts;
  decisions: Decision[];
  requests: ActiveRequest[];
};

export async function getCommandData(): Promise<CommandData> {
  return {
    isSample: true,
    company: { name: "SSAIR", kind: "مناولة أرضية" },
    user: { name: "مدير الوردية", role: "قسم العمليات" },
    shadowMode: true,
    counts: { inboxToReview: null, draftsWaiting: null, urgentAlerts: null },
    radar: { onGround: null, inbound: null, delayed: null, awaitingMsg: null },
    decisions: [
      { id: "d1", tone: "late", text: "طلب تصريح ينتظر موافقة الجهة (مثال)", action: "افتح ملف الطلب" },
      { id: "d2", tone: "warn", text: "مسودة رد جاهزة لمراجعتك (مثال)", action: "راجع المسودة" },
      { id: "d3", tone: "info", text: "تغيّر موعد رحلة: راجع التصاريح (مثال)", action: "راجع التصاريح" },
    ],
    requests: [
      { id: "r1", airline: "8U", title: "إذن تشغيل طارئ", status: "قيد التنفيذ", tone: "info", next: "بانتظار الجهة" },
      { id: "r2", airline: "8U", title: "تأكيد سلوت", status: "على المسار", tone: "ok", next: "رد على الشركة" },
      { id: "r3", airline: "8U", title: "خدمة ركاب", status: "مؤكد", tone: "ok", next: "لا شيء مطلوب" },
    ],
  };
}
