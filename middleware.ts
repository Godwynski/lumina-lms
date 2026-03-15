import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const OFFLINE_JWT_SECRET = process.env.OFFLINE_JWT_SECRET || "emergency_offline_secret_key_12345";

export async function middleware(request: NextRequest) {
  const offlineSession = request.cookies.get("offline_session")?.value;
  const path = request.nextUrl.pathname;

  // 1. If user has an offline session, restrict their movement
  if (offlineSession) {
    try {
      const secret = new TextEncoder().encode(OFFLINE_JWT_SECRET);
      await jose.jwtVerify(offlineSession, secret);

      // User has a valid offline token. 
      // Allowed paths: /protected/resources, /api/resources, /api/offline, /_next, favicon.ico
      const isAllowed = 
        path.startsWith("/protected/resources") || 
        path.startsWith("/api/resources") || 
        path.startsWith("/api/offline") ||
        path === "/offline-landing" ||
        path === "/offline-access";

      if (!isAllowed && (path.startsWith("/protected") || path.startsWith("/api"))) {
        // Redirect to offline landing page for restricted routes
        return NextResponse.redirect(new URL("/offline-landing", request.url));
      }
      
      // If they are on an allowed path or not in a restricted area, let them through
      return NextResponse.next();
    } catch (e) {
      // Invalid or expired token
      const response = NextResponse.redirect(new URL("/offline-access", request.url));
      response.cookies.delete("offline_session");
      return response;
    }
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
