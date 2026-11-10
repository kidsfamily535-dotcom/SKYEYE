import { createClient } from "@/lib/supabase/server";

export const HANDLER_TYPES = ["ground_handler", "cargo_terminal", "forwarder", "fbo"] as const;
export const AIRLINE_TYPES = ["passenger_airline", "cargo_airline"] as const;
export const COMPANY_TYPES = [...HANDLER_TYPES, ...AIRLINE_TYPES] as const;
export const MODULES = ["emails", "flights", "requests", "complaints", "otp", "slots", "schedules", "handover", "handler_followup"] as const;
export const ROLES = ["owner", "admin", "operator", "viewer"] as const;
export const STATUSES = ["trial", "active", "suspended"] as const;

export type OwnerCompany = {
  id: string; name: string; code: string | null; country: string | null; business_types: string[]; data_class: string;
  plan_code: string | null; status: string | null; renews_on: string | null;
  members: number; airlines: number; last_activity_at: string | null;
};
export type OwnerAirline = { airline_id: string; iata: string | null; icao: string | null; name: string; country: string | null; contract_status: string };
export type OwnerDetail = {
  id: string; name: string; code: string | null; country: string | null; business_types: string[]; data_class: string;
  plan_code: string | null; status: string | null; renews_on: string | null; notes: string | null;
  modules: Record<string, boolean>; airlines: OwnerAirline[];
  members: { membership_id: string; role: string; email: string | null }[];
};
export type Plan = { code: string; name_ar: string; name_en: string; audience: "handler" | "airline"; modules: string[]; sort: number };
export type AirlineHit = { id: string; iata: string | null; icao: string | null; name: string; country: string | null };

export type Res<T> = { status: "ok"; data: T } | { status: "denied" } | { status: "error" };

/** True only for the platform owner. Never throws: any failure means "not the owner". */
export async function isPlatformAdmin(): Promise<boolean> {
  try {
    const { data } = await (await createClient()).rpc("am_i_platform_admin");
    return data === true;
  } catch { return false; }
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Res<T>> {
  try {
    const { data, error } = await (await createClient()).rpc(fn, args);
    if (error) return { status: error.code === "42501" ? "denied" : "error" };
    return { status: "ok", data: data as T };
  } catch { return { status: "error" }; }
}

export const listCompanies = () => call<OwnerCompany[]>("admin_companies");
export const getCompany = (id: string) => call<OwnerDetail>("admin_company_detail", { p_company: id });
export const searchAirlines = (q: string) => call<AirlineHit[]>("admin_search_airlines", { p_q: q });

export async function listPlans(): Promise<Plan[]> {
  try {
    const { data } = await (await createClient()).from("plans").select("code,name_ar,name_en,audience,modules,sort").eq("active", true).order("sort");
    return (data ?? []) as Plan[];
  } catch { return []; }
}

/** Country name in the UI language from an ISO code; falls back to the code. */
export function countryName(code: string | null, lang: "ar" | "en"): string {
  if (!code) return "—";
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code; } catch { return code; }
}
/** True when the airline's country (English name in the airlines table) differs from the company's own country. */
export function isForeign(companyCountry: string | null, airlineCountry: string | null): boolean {
  if (!companyCountry || !airlineCountry) return false;
  try { return (new Intl.DisplayNames(["en"], { type: "region" }).of(companyCountry) ?? "").toLowerCase() !== airlineCountry.toLowerCase(); } catch { return false; }
}
