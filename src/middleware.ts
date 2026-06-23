import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie on every request and gates access:
 * unauthenticated users are redirected to /login (except public auth routes).
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") || path.startsWith("/register") ||
    path.startsWith("/auth") || path.startsWith("/api");

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they were headed so we can return after sign-in.
    if (path && path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // Signed-in users shouldn't see the auth screens.
  if (user && (path === "/login" || path === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
