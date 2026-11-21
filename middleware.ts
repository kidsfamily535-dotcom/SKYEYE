import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and sends anonymous visitors to /login.
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const inEye = path === "/eye" || path.startsWith("/eye/");
  const onEyeLogin = path === "/eye/login";
  const onLogin = path.startsWith("/login") || path.startsWith("/signup");
  if (!user) return onLogin || onEyeLogin ? res : NextResponse.redirect(new URL(inEye ? "/eye/login" : "/login", req.url));
  if (onEyeLogin) return NextResponse.redirect(new URL("/eye", req.url));
  if (onLogin) return NextResponse.redirect(new URL("/", req.url));
  // Airline Eye users live in /eye only; SKYEYE staff never see /eye. Routing convenience only: the real boundary is the database
  // (RLS on SKYEYE tables, can_view() inside every eye_* function). If the lookup fails we do not redirect.
  if (!path.startsWith("/auth/")) {
    const [sky, eye] = await Promise.all([
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.rpc("eye_my_workspaces"),
    ]);
    if (!sky.error && !eye.error && Array.isArray(eye.data)) {
      const isSky = (sky.count ?? 0) > 0, isEye = eye.data.length > 0;
      if (isEye && !isSky && !inEye) return NextResponse.redirect(new URL("/eye", req.url));
      if (!isEye && inEye) return NextResponse.redirect(new URL("/", req.url));
    }
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|bg-.*\\.jpg).*)"] };
