import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MODE_COOKIE } from "@/lib/mode";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(MODE_COOKIE);
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
