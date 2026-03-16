import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const offlineToken = request.cookies.get("offline_session")?.value;
  const path = request.nextUrl.pathname;

  // 1. Static asset bypass
  if (
    path.startsWith("/_next") || 
    path.startsWith("/static") || 
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. If user has an offline (opaque) session token
  if (offlineToken) {
    // We need to verify this token against the database
    // Note: In a real blackout, this hits the local DB.
    let response = NextResponse.next();
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
              request.cookies.set(name, value)
            );
            response = NextResponse.next();
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: session, error } = await supabase
      .from("offline_sessions")
      .select("*, profiles(role)")
      .eq("session_token", offlineToken)
      .single();

    if (error || !session) {
      // Invalid or revoked session
      const redirectResponse = NextResponse.redirect(new URL("/offline-access", request.url));
      redirectResponse.cookies.delete("offline_session");
      return redirectResponse;
    }

    // 3. Restriction Logic: offline sessions are strictly limited to /protected/resources
    // The spec explicitly requires /renew, /my-card, /profile, /borrow to redirect to offline-landing.
    const OFFLINE_RESTRICTED_PATHS = [
      "/protected/renew",
      "/protected/borrow",
      "/protected/my-card",
      "/protected/history",
      "/protected/profile",
      "/protected/fines",
      "/protected/settings",
      "/protected/audit",
      "/protected/users",
      "/protected/catalog",
      "/protected/reports",
      "/protected/admin",
    ];

    const isAllowedPath = 
      path.startsWith("/protected/resources") || 
      path.startsWith("/api/resources") || 
      path.startsWith("/offline") ||
      path === "/offline-landing" ||
      path === "/offline-access";
    
    const isRestrictedPath = OFFLINE_RESTRICTED_PATHS.some((blocked) =>
      path.startsWith(blocked)
    );

    // If they try to access restricted routes, block them
    if (isRestrictedPath || (!isAllowedPath && (path.startsWith("/protected") || path.startsWith("/api")))) {
      // Privileged staff can still roam freely even on an offline session
      const userRole = (session.profiles as any)?.role;
      const isPrivileged = ["admin", "librarian", "staff"].includes(userRole);

      if (!isPrivileged) {
        return NextResponse.redirect(new URL("/offline-landing", request.url));
      }
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
