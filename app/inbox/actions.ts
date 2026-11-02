"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/lang";

export async function saveDraftEdit(draftId: string, body: string) {
  const { error } = await (await createClient()).rpc("save_draft_edit", { p_draft_id: draftId, p_body: body });
  if (error) return { ok: false as const, message: (await getT()).t("inbox.err.save") };
  revalidatePath("/inbox"); return { ok: true as const };
}

/** "Sent" = the human employee sent it from their own mailbox. SKYEYE sends nothing itself. */
export async function markDraftSent(draftId: string) {
  const { error } = await (await createClient()).rpc("mark_draft_sent", { p_draft_id: draftId });
  if (error) return { ok: false as const, message: (await getT()).t("inbox.err.sent") };
  revalidatePath("/inbox"); revalidatePath("/"); return { ok: true as const };
}
