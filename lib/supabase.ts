import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Returns null until env vars are set (Session 2 wires auth). */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
