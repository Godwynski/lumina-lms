import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicAuthPaths = ["/login", "/sign-up", "/forgot-password", "/update-password", "/confirm", "/error", "/callback", "/sign-up-success"];
  const isAuthRoute = publicAuthPaths.some(p => path.startsWith(p));
  const isApiRoute = path.startsWith("/api");
  const isBookRoute = path.startsWith("/book");
  const isPublicRoute = path === "/" || isAuthRoute || isApiRoute || isBookRoute;

  let supabaseResponse = NextResponse.next({ request });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  // Fast path for public routes when no Supabase session cookie is present.
  // This avoids unnecessary auth client creation and token work for anonymous traffic.
  if (isPublicRoute && !hasSupabaseSessionCookie) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() reads the JWT locally — zero network round-trip
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // 1. Unauthenticated → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2. Read role from app_metadata (set by admin API, no DB query needed)
  //    Falls back to 'student' for users who signed up through the app.
  const userRole: string = (user as Record<string, unknown> | null)?.app_metadata
    ? ((user as Record<string, Record<string, unknown>>).app_metadata?.role as string) ?? "student"
    : "student";

  // 3. RBAC Route Guards — pure in-memory, <1ms
  if ((path.startsWith("/admin") || path.startsWith("/audit")) && userRole !== "admin") {
    return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
  }

  if (path.startsWith("/librarian") && !["admin", "librarian"].includes(userRole)) {
    return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
  }

  if (path.startsWith("/staff") && !["admin", "librarian", "staff"].includes(userRole)) {
    return NextResponse.redirect(new URL("/dashboard?error=unauthorized", request.url));
  }

  return supabaseResponse;
}
