import { createClient } from "@/lib/supabase/server";
import type { TFn } from "@/lib/i18n";

/** One row of the flight program, in the shape the database function expects. */
export type ProgramRow = { fn: string; stn: string; origin: string; dest: string; date: string; sta: string; std: string; dep?: string; block_min?: string; reg?: string };
export type RowCheck = { i: number; fn: string; stn: string; origin: string; dest: string; date: string; sta: string; std: string; dep: string | null; block_min: string | null; reg: string | null; errors: string[]; warnings: string[] };
export type ProgramResult = {
  committed: boolean; total: number; blocking_rows: number; rows: RowCheck[];
  missing_airlines: string[]; missing_stations: string[]; airlines_added?: number; stations_added?: number;
  result?: { rows: number; flights_inserted: number; flights_skipped_existing: number };
};

const ALIASES: Record<keyof ProgramRow, string[]> = {
  fn: ["fn", "flight", "flightno", "flightnumber", "flt", "رقمالرحلة", "الرحلة"],
  stn: ["stn", "station", "المحطة"],
  origin: ["origin", "from", "orig", "منمطار", "القدوم"],
  dest: ["dest", "to", "destination", "الوجهة"],
  date: ["date", "التاريخ"],
  sta: ["sta", "arrival", "arr", "الوصول"],
  std: ["std", "departure", "dep_time", "المغادرة"],
  dep: ["dep", "originstd", "origindep"],
  block_min: ["blockmin", "block", "blockminutes", "flighttime"],
  reg: ["reg", "registration", "tail", "التسجيل"],
};
const norm = (s: string) => s.toLowerCase().replace(/[\s_\-./]/g, "");

function splitLine(line: string, d: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (ch === '"') { if (q && line[k + 1] === '"') { cur += '"'; k++; } else q = !q; }
    else if (ch === d && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur); return out.map((c) => c.trim());
}

/** "5/11/2026" is read day/month/year (Egypt convention); ISO dates pass through. The preview shows the result so the user can verify. */
function fixDate(v: string): string {
  const s = v.trim();
  const m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s.replace(/[T ].*$/, "");
}
/** "09:05:00" -> "09:05" (Excel often adds seconds). */
const fixTime = (v: string) => { const m = v.trim().match(/^(\d{1,2}):(\d{2})(:\d{2})?$/); return m ? `${m[1]}:${m[2]}` : v.trim(); };

export type ParseOut = { ok: true; rows: ProgramRow[] } | { ok: false; message: string };

export function parseProgram(text: string, t: TFn): ParseOut {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { ok: false, message: t("imp.p.headerRows") };
  const head = lines[0];
  const d = head.includes("\t") ? "\t" : head.includes(";") ? ";" : ",";
  const cols = splitLine(head, d).map(norm);
  const idx: Partial<Record<keyof ProgramRow, number>> = {};
  (Object.keys(ALIASES) as (keyof ProgramRow)[]).forEach((k) => { const p = cols.findIndex((c) => ALIASES[k].includes(c)); if (p >= 0) idx[k] = p; });
  const need: (keyof ProgramRow)[] = ["fn", "stn", "origin", "dest", "date", "sta", "std"];
  const lacking = need.filter((k) => idx[k] === undefined);
  if (lacking.length) return { ok: false, message: t("imp.p.lacking", { cols: lacking.join(t("imp.sep")) }) };
  if (lines.length - 1 > 500) return { ok: false, message: t("imp.p.max") };
  const rows: ProgramRow[] = lines.slice(1).map((l) => {
    const c = splitLine(l, d); const g = (k: keyof ProgramRow) => (idx[k] === undefined ? "" : (c[idx[k]!] ?? ""));
    return { fn: g("fn"), stn: g("stn"), origin: g("origin"), dest: g("dest"), date: fixDate(g("date")), sta: fixTime(g("sta")), std: fixTime(g("std")), dep: fixTime(g("dep")), block_min: g("block_min"), reg: g("reg") };
  });
  return { ok: true, rows };
}

export type ImportContext = { companyId: string; role: string; canWrite: boolean; canAdmin: boolean; stations: string[]; airlines: string[] } | null;

export async function getImportContext(): Promise<ImportContext> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: m } = await sb.from("memberships").select("role, company_id").eq("user_id", user.id).maybeSingle();
  if (!m) return null;
  const [st, al] = await Promise.all([
    sb.from("stations").select("airports(iata_code)").eq("company_id", m.company_id),
    sb.from("company_airlines").select("airlines(iata_code)").eq("company_id", m.company_id),
  ]);
  const code = (x: unknown, k: string) => { const o = Array.isArray(x) ? x[0] : x; return (o as Record<string, string | null> | null)?.[k] ?? null; };
  const stations = (st.data ?? []).map((r) => code((r as { airports: unknown }).airports, "iata_code")).filter(Boolean) as string[];
  const airlines = (al.data ?? []).map((r) => code((r as { airlines: unknown }).airlines, "iata_code")).filter(Boolean) as string[];
  return { companyId: m.company_id, role: m.role, canWrite: m.role !== "viewer", canAdmin: m.role === "owner" || m.role === "admin", stations: stations.sort(), airlines: airlines.sort() };
}
