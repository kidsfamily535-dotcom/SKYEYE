import { createClient } from "@/lib/supabase/server";
import { airlinePrefix, resolveAirlines, type Airline } from "@/lib/requests";

/**
 * Flight Operations Live Board — كل ما يُعرض مشتق من أوقات وسجلات موجودة فعلاً في القاعدة
 * (v_flight_file / v_ground_clock / v_flight_file_sop / turnaround_checkins / message_drafts) مقابل الساعة الحالية.
 * لا تقدير ولا قيم مولَّدة: ما لا مصدر له يظهر «—».
 */

export type BoardTab = "all" | "arrival" | "turnaround" | "departure" | "done";
export type Phase = "arrival" | "turnaround" | "departure" | "done";
export type Sla = "late" | "risk" | "ok" | "none";
export type BoardEvent = { id: string; rotationId: string; flight: string; tone: "late" | "warn" | "info"; text: string; rank: number };
export type BoardRow = {
  rotationId: string; flightIn: string | null; flightOut: string | null; callIn: string | null; callOut: string | null; registration: string | null;
  origin: string | null; station: string | null; destination: string | null;
  sta: string | null; std: string | null; eta: string | null; etd: string | null; ata: string | null; atd: string | null;
  status: string; phase: Phase; stage: string; next: string | null; sla: Sla; slaWhy: string | null; alert: string | null;
  stale: boolean; airline: Airline | null; dateIn: string | null; dateOut: string | null;
};
export type Board = {
  rows: BoardRow[];
  counts: { all: number; arrival: number; turnaround: number; departure: number; todayTotal: number; todayOnSchedule: number; todayTurnaround: number; todayAttention: number };
  events: BoardEvent[];
  /** كل المهل المستخدمة محسوبة من قوالب لم تُعتمد بعد */
  draftBasis: boolean;
  /** بحث باليوم أو برقم الرحلة مفعّل */
  filtered: boolean;
  /** النص المكتوب أرقام فقط: لا يُبحث به لأن رقم الرحلة يسبقه كود الشركة دائماً */
  qNeedsCode: boolean;
};

type Raw = Record<string, any>;
const MIN = 60_000;
const ms = (x: string | null | undefined) => (x ? +new Date(x) : null);
export const hm = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(11, 16) : "—");
const DEPARTURE_TRACKS = new Set(["DEPARTURE", "PAX_DEPARTURE"]);
const STEP_COLS = "rotation_id, track, track_order, seq, step_code, name_ar, name_en, is_critical, step_state, planned_at, actual_at, sop_status";

async function fetchSteps(sb: Awaited<ReturnType<typeof createClient>>, ids: string[]): Promise<Raw[]> {
  if (!ids.length) return [];
  const out: Raw[] = [];
  for (let from = 0; from < 8000; from += 1000) {
    const { data } = await sb.from("v_flight_file_sop").select(STEP_COLS)
      .in("rotation_id", ids).or("planned_at.not.is.null,actual_at.not.is.null")
      .order("rotation_id").order("track_order").order("seq").order("step_code").range(from, from + 999);
    if (!data) break;
    out.push(...(data as Raw[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function getBoard(tab: BoardTab, filter?: { q?: string; day?: string }): Promise<Board> {
  const sb = await createClient();
  const now = Date.now(); const today = new Date(now).toISOString().slice(0, 10);

  const { data: act } = await sb.from("v_flight_file").select("*").is("atd", null).neq("status", "cancelled").order("sta", { ascending: true, nullsFirst: false }).limit(300);
  const active = (act ?? []) as Raw[];
  const ids = active.map((r) => r.rotation_id as string);

  const [steps, clk, qs, drafts, doneQ, legCs] = await Promise.all([
    fetchSteps(sb, ids),
    sb.from("v_ground_clock").select("rotation_id, expected_std, arrival_delay_min, arrival_leg_id, departure_leg_id").limit(1000),
    sb.from("turnaround_checkins").select("id, flight_id, step_code, question_ar, due_at, status").in("status", ["asked", "in_progress", "late", "escalated"]).limit(200),
    sb.from("message_drafts").select("id, message_type, flight_id, status").eq("status", "draft").limit(200),
    tab === "done"
      ? sb.from("v_flight_file").select("*").or("atd.not.is.null,status.eq.cancelled").order("std", { ascending: false, nullsFirst: false }).limit(50)
      : Promise.resolve({ data: [] as Raw[] }),
    sb.from("flights").select("rotation_id, direction, callsign").in("rotation_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).limit(1000),
  ]);

  const clockBy = new Map<string, Raw>(); const legToRot = new Map<string, string>();
  for (const c of (clk.data ?? []) as Raw[]) { clockBy.set(c.rotation_id, c); if (c.arrival_leg_id) legToRot.set(c.arrival_leg_id, c.rotation_id); if (c.departure_leg_id) legToRot.set(c.departure_leg_id, c.rotation_id); }
  const doneIds = ((doneQ.data ?? []) as Raw[]).map((r) => r.rotation_id as string);
  const doneCs = doneIds.length ? ((await sb.from("flights").select("rotation_id, direction, callsign").in("rotation_id", doneIds).limit(1000)).data ?? []) : [];
  const cs = new Map<string, string | null>();
  for (const f of [...((legCs.data ?? []) as Raw[]), ...(doneCs as Raw[])]) cs.set(`${f.rotation_id}:${f.direction}`, f.callsign ?? null);
  const stepsBy = new Map<string, Raw[]>();
  for (const s of steps) { const a = stepsBy.get(s.rotation_id) ?? []; a.push(s); stepsBy.set(s.rotation_id, a); }
  const qBy = new Map<string, Raw[]>();
  for (const q of (qs.data ?? []) as Raw[]) { const rid = legToRot.get(q.flight_id); if (!rid) continue; const a = qBy.get(rid) ?? []; a.push(q); qBy.set(rid, a); }
  const dBy = new Map<string, Raw[]>();
  for (const d of (drafts.data ?? []) as Raw[]) { const rid = d.flight_id ? legToRot.get(d.flight_id) : undefined; if (!rid) continue; const a = dBy.get(rid) ?? []; a.push(d); dBy.set(rid, a); }

  const events: BoardEvent[] = [];
  let anyApproved = false; let anyStep = false;

  const build = (r: Raw): BoardRow => {
    const rid = r.rotation_id as string;
    const label = (r.flight_in ?? r.flight_out ?? "—") as string;
    const st = stepsBy.get(rid) ?? [];
    const clock = clockBy.get(rid);
    const recorded = st.filter((s) => s.step_state === "recorded" && s.actual_at).sort((a, b) => ms(b.actual_at)! - ms(a.actual_at)!);
    const pending = st.filter((s) => s.step_state !== "recorded" && s.planned_at).sort((a, b) => ms(a.planned_at)! - ms(b.planned_at)!);
    if (st.length) { anyStep = true; if (st.some((s) => s.sop_status && s.sop_status !== "draft")) anyApproved = true; }

    const phase: Phase = r.atd ? "done" : !r.ata ? "arrival" : recorded.some((s) => DEPARTURE_TRACKS.has(s.track)) ? "departure" : "turnaround";
    const staMs = ms(r.sta); const stdMs = ms(r.std);
    const staMissed = !r.ata && !r.atd && staMs !== null && staMs < now - 15 * MIN;
    const arrLate = Number(clock?.arrival_delay_min ?? 0);
    const etdDiff = clock?.expected_std && stdMs !== null ? Math.round((ms(clock.expected_std)! - stdMs) / MIN) : 0;
    const overdue = r.ata ? pending.filter((s) => ms(s.planned_at)! < now) : [];
    const due = r.ata ? pending.filter((s) => { const t = ms(s.planned_at)!; return t >= now && t <= now + 10 * MIN; }) : [];
    const soon = pending.filter((s) => { const t = ms(s.planned_at)!; return t >= now && t <= now + 15 * MIN; });
    const openQ = qBy.get(rid) ?? [];
    const dr = dBy.get(rid) ?? [];

    const ev: BoardEvent[] = [];
    const push = (tone: BoardEvent["tone"], rank: number, text: string, k: string) => ev.push({ id: `${rid}-${k}`, rotationId: rid, flight: label, tone, text, rank });
    if (staMissed) push("late", 90, `لم يُسجَّل ATA بعد موعد الوصول المجدول ${hm(r.sta)}`, "sta");
    if (overdue.length) {
      const top = overdue.find((s) => s.is_critical) ?? overdue[0];
      const late = Math.round((now - ms(top.planned_at)!) / MIN);
      push("late", 80, `مرحلة تجاوزت Target Time: ${top.name_ar ?? top.name_en} (مجدولة ${hm(top.planned_at)}، +${late} د)`, "overdue");
    }
    for (const q of openQ) push(q.status === "late" || q.status === "escalated" ? "late" : "warn", 70, `الوكيل ينتظر تأكيدك: ${q.question_ar}`, `q-${q.id}`);
    if (due.length) push("warn", 60, `حان موعد: ${due[0].name_ar ?? due[0].name_en} (${hm(due[0].planned_at)})`, "due");
    if (!r.ata && arrLate >= 15) push("warn", 55, `تأخر متوقع في الوصول ${arrLate} دقيقة`, "arrlate");
    if (etdDiff >= 15) push("warn", 50, `ETD المتوقع ${hm(clock!.expected_std)} بعد STD بـ ${etdDiff} د — يحتاج إعادة حساب`, "etd");
    for (const d of dr) push("info", 40, `مسودة رسالة ${d.message_type} بانتظار المراجعة`, `d-${d.id}`);
    ev.sort((a, b) => b.rank - a.rank);
    events.push(...ev);

    const hasTargets = st.some((s) => s.planned_at);
    const sla: Sla = (overdue.length || etdDiff >= 15 || staMissed) ? "late"
      : (soon.length || arrLate >= 10 || openQ.length) ? "risk"
      : hasTargets ? "ok" : "none";
    const slaWhy = sla === "late" ? (ev[0]?.text ?? null) : sla === "risk" ? (ev[0]?.text ?? null) : null;

    const last = recorded[0];
    const nxt = pending[0];
    const stage = r.atd ? "غادرت" : last ? (last.name_ar ?? last.name_en) : phase === "arrival" ? "بانتظار الهبوط (ATA)" : "بانتظار تسجيل أول مرحلة";
    const next = nxt ? `${nxt.name_ar ?? nxt.name_en} · ${hm(nxt.planned_at)}` : null;
    const stale = !r.atd && String(r.date_out ?? r.date_in ?? "9999") < today;
    const p = airlinePrefix(r.flight_in ?? r.flight_out);
    return {
      rotationId: rid, flightIn: r.flight_in, flightOut: r.flight_out, callIn: cs.get(`${rid}:arrival`) ?? null, callOut: cs.get(`${rid}:departure`) ?? null, registration: r.registration, origin: r.origin, station: r.station, destination: r.destination,
      sta: r.sta, std: r.std, eta: r.eta, etd: clock?.expected_std ?? null, ata: r.ata, atd: r.atd, status: r.status, phase, stage, next, sla, slaWhy,
      alert: ev[0]?.text ?? null, stale, dateIn: r.date_in ?? null, dateOut: r.date_out ?? null, airline: (p.iata ?? p.icao) ? { code: (p.iata ?? p.icao) as string, name: null, logoUrl: null } : null,
    };
  };

  const activeRows = active.map(build);
  // القديمة غير المغلقة تُعرض بعد رحلات اليوم وما بعدها
  const ordered = [...activeRows.filter((r) => !r.stale), ...activeRows.filter((r) => r.stale).reverse()];
  const doneRows: BoardRow[] = ((doneQ.data ?? []) as Raw[]).map((r) => ({
    rotationId: r.rotation_id, flightIn: r.flight_in, flightOut: r.flight_out, callIn: cs.get(`${r.rotation_id}:arrival`) ?? null, callOut: cs.get(`${r.rotation_id}:departure`) ?? null, registration: r.registration, origin: r.origin, station: r.station, destination: r.destination,
    sta: r.sta, std: r.std, eta: r.eta, etd: null, ata: r.ata, atd: r.atd, status: r.status, phase: "done" as Phase,
    stage: r.status === "cancelled" ? "ملغاة" : "غادرت", next: null, sla: "none" as Sla, slaWhy: null, alert: null, stale: false, airline: null, dateIn: r.date_in ?? null, dateOut: r.date_out ?? null,
  }));

  const q = (filter?.q ?? "").toUpperCase().replace(/[\s-]/g, "");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(filter?.day ?? "") ? (filter!.day as string) : null;
  const norm = (x: string | null) => (x ?? "").toUpperCase().replace(/[\s-]/g, "");
  // رقم الرحلة = كود الشركة + الرقم (NE231) أو الـ call sign (ABY553). أرقام فقط لا تُقبل لأنها تلتبس بين الشركات.
  const qNeedsCode = !!q && /^\d+$/.test(q);
  const qq = qNeedsCode ? "" : q;
  const match = (r: BoardRow) => (!day || r.dateIn === day || r.dateOut === day)
    && (!qq || [r.flightIn, r.flightOut, r.callIn, r.callOut].some((x) => norm(x).startsWith(qq)) || norm(r.registration).includes(qq));
  let rows = (tab === "done" ? doneRows : tab === "all" ? ordered : ordered.filter((r) => r.phase === tab)).filter(match);
  const air = await resolveAirlines(rows.map((r) => r.flightIn ?? r.flightOut));
  rows = rows.map((r) => { const p = airlinePrefix(r.flightIn ?? r.flightOut); const k = p.iata ?? p.icao; return { ...r, airline: k ? air.get(k) ?? { code: k, name: null, logoUrl: null } : null }; });

  const todayRows = activeRows.filter((r, i) => active[i].date_in === today || active[i].date_out === today);
  return {
    rows,
    counts: {
      all: ordered.length, arrival: ordered.filter((r) => r.phase === "arrival").length,
      turnaround: ordered.filter((r) => r.phase === "turnaround").length, departure: ordered.filter((r) => r.phase === "departure").length,
      todayTotal: todayRows.length, todayOnSchedule: todayRows.filter((r) => r.sla === "ok").length,
      todayTurnaround: todayRows.filter((r) => r.phase === "turnaround").length,
      todayAttention: todayRows.filter((r) => r.sla === "late" || r.sla === "risk").length,
    },
    events: events.filter((e) => ordered.some((r) => r.rotationId === e.rotationId && !r.stale)).sort((a, b) => b.rank - a.rank),
    draftBasis: anyStep && !anyApproved,
    filtered: !!qq || !!day,
    qNeedsCode,
  };
}
