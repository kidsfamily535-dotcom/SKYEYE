import { createClient } from "@/lib/supabase/server";

export const CATEGORY_AR: Record<string, string> = {
  mvt: "رسالة حركة", load_message: "رسالة حمولة", schedule: "جدول رحلات", service_request: "طلب خدمة", slot: "سلوت",
  permit: "تصريح", finance: "مالية", complaint: "شكوى", general: "عام", unknown: "غير مصنّف",
};
export const URGENCY_AR: Record<string, string> = { normal: "عادي", important: "مهم", urgent: "عاجل" };
export const STATUS_AR: Record<string, string> = { new: "جديد", reviewed: "تمت المراجعة", replied: "تم الرد", no_reply_needed: "لا يحتاج رداً", dismissed: "مستبعد" };

export type InboxItem = {
  id: string; messageId: string; category: string; summary: string | null; requestedAction: string | null; replyReason: string | null; replyKind: string | null;
  urgency: string; confidence: string; status: string; createdAt: string;
  message: { from: string | null; to: string[]; cc: string[]; subject: string | null; body: string | null; quoted: string | null; at: string | null; hasAttachments: boolean } | null;
  draft: { id: string; subject: string | null; body: string; to: string | null; status: string; warnings: string[] } | null;
};

/** What the employee sees on each email: new, has a draft waiting for review, replied. Derived from the stored status and the draft, nothing guessed. */
export type InboxState = "new" | "drafted" | "replied" | "other";
export const stateOf = (i: InboxItem): InboxState => (i.status === "replied" ? "replied" : i.status === "new" ? (i.draft?.status === "draft" ? "drafted" : "new") : "other");
export const stateLabel = (i: InboxItem) => ({ new: "جديد", drafted: "عليه مسودة", replied: "تم الرد", other: STATUS_AR[i.status] ?? i.status } as const)[stateOf(i)];
export const stateTone = (i: InboxItem) => ({ new: "warn", drafted: "info", replied: "ok", other: "info" } as const)[stateOf(i)];

export async function getInbox(): Promise<InboxItem[]> {
  const sb = await createClient();
  const { data: tri } = await sb.from("email_triage").select("id, category, summary, requested_action, reply_reason, reply_kind, urgency, confidence, status, created_at, message_id").order("created_at", { ascending: false }).limit(100);
  if (!tri?.length) return [];
  const [msgs, drafts] = await Promise.all([
    sb.from("email_messages").select("id, from_address, to_addresses, cc_addresses, subject, body_text, new_text, quoted_text, received_at, sent_at, has_attachments").in("id", tri.map((t) => t.message_id)),
    sb.from("email_reply_drafts").select("id, triage_id, subject, body_text, to_address, status, warnings, created_at").in("triage_id", tri.map((t) => t.id)).neq("status", "superseded").order("created_at", { ascending: false }),
  ]);
  const rank: Record<string, number> = { urgent: 0, important: 1, normal: 2 };
  return tri.map((t) => {
    const m = msgs.data?.find((x) => x.id === t.message_id);
    const d = drafts.data?.find((x) => x.triage_id === t.id);
    return {
      id: t.id, messageId: t.message_id, category: t.category, summary: t.summary, requestedAction: t.requested_action, replyReason: t.reply_reason, replyKind: t.reply_kind,
      urgency: t.urgency, confidence: t.confidence, status: t.status, createdAt: t.created_at,
      message: m ? { from: m.from_address, to: m.to_addresses ?? [], cc: m.cc_addresses ?? [], subject: m.subject, body: m.new_text ?? m.body_text, quoted: m.quoted_text, at: m.received_at ?? m.sent_at, hasAttachments: m.has_attachments } : null,
      draft: d ? { id: d.id, subject: d.subject, body: d.body_text, to: d.to_address, status: d.status, warnings: Array.isArray(d.warnings) ? d.warnings.map(String) : [] } : null,
    };
  }).sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1) || rank[a.urgency] - rank[b.urgency] || +new Date(b.createdAt) - +new Date(a.createdAt));
}
