import { NextResponse } from "next/server";

/**
 * Cloud heartbeat endpoint.
 * The public portal polls this every 60 s to determine if the school's local
 * server sync worker is reachable. If the response is older than 15 minutes,
 * the HeartbeatBanner shows a warning to the user.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: Date.now() },
    {
      headers: {
        // Never let a CDN cache this — it must always be a live response
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
