import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Double-layer asset bypass for maximum performance on edge
  if (
    path.startsWith("/_next") || 
    path.startsWith("/static") || 
    path === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(path)
  ) {
    return NextResponse.next();
  }

  // 2. Refresh session and enforce RBAC rules via Supabase helper
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Next.js 16 Proxy Matcher:
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Images/Assets with common extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
