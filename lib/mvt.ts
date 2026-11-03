import { createClient } from "@/lib/supabase/server";

export type MvtEvent = { event_type: string; occurred_at: string };
export type MvtItem = {
  id: string; parseStatus: string; matchStatus: string; flightId: string | null; flightLabel: string | null;
  events: MvtEvent[]; warnings: string[]; notes: string[]; body: string | null; subject: string | null; direction: string | null; at: string | null;
  candidates: { id: string; label: string }[];
};

type Parsed = { warnings?: unknown; events?: MvtEvent[]; match?: { notes?: unknown } };
const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export async function getPendingMvt(): Promise<MvtItem[]> {
  const sb = await createClient();
  const { data: pm } = await sb.from("parsed_messages")
    .select("id, message_id, parse_status, match_status, flight_id, data, created_at")
    .eq("message_type", "MVT").eq("review_status", "pending").order("created_at", { ascending: true }).limit(100);
  if (!pm?.length) return [];
  const flightIds = [...new Set(pm.map((p) => p.flight_id).filter(Boolean))] as string[];
  const [msgs, flts, recent] = await Promise.all([
    sb.from("email_messages").select("id, subject, body_text, direction, sent_at").in("id", pm.map((p) => p.message_id)),
    flightIds.length ? sb.from("flights").select("id, flight_number, flight_date").in("id", flightIds) : Promise.resolve({ data: [] as { id: string; flight_number: string | null; flight_date: string | null }[] }),
    sb.from("flights").select("id, flight_number, flight_date, direction").order("flight_date", { ascending: false }).limit(60),
  ]);
  const label = (f: { flight_number: string | null; flight_date: string | null }) => `${f.flight_number ?? "—"} · ${f.flight_date ?? "—"}`;
  return pm.map((p) => {
    const m = msgs.data?.find((x) => x.id === p.message_id);
    const f = flts.data?.find((x) => x.id === p.flight_id);
    const d = (p.data ?? {}) as Parsed;
    return {
      id: p.id, parseStatus: p.parse_status, matchStatus: p.match_status, flightId: p.flight_id, flightLabel: f ? label(f) : null,
      events: Array.isArray(d.events) ? d.events : [], warnings: strs(d.warnings), notes: strs(d.match?.notes),
      body: m?.body_text ?? null, subject: m?.subject ?? null, direction: m?.direction ?? null, at: m?.sent_at ?? null,
      candidates: p.match_status === "matched" ? [] : (recent.data ?? []).map((x) => ({ id: x.id, label: label(x) })),
    };
  });
}
