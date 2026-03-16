"use client";

import { useEffect, useRef, useState } from "react";
import { ServerCrash } from "lucide-react";

const HEARTBEAT_URL = "/api/heartbeat";
const POLL_INTERVAL_MS = 60_000; // poll every 60 seconds
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Polls /api/heartbeat every 60 seconds.
 * Shows a warning banner if the last successful heartbeat is older than 15 minutes
 * while the browser still has internet connectivity (i.e., the school's local server
 * is down, but the user's device has internet).
 */
export function HeartbeatBanner() {
  const [serverOffline, setServerOffline] = useState(false);
  const lastSeenRef = useRef<number | null>(null);

  const checkHeartbeat = async () => {
    // Don't show this banner on top of the OfflineBanner; browser already offline
    if (!navigator.onLine) {
      setServerOffline(false);
      return;
    }
    try {
      const res = await fetch(HEARTBEAT_URL, { cache: "no-store" });
      if (res.ok) {
        lastSeenRef.current = Date.now();
        setServerOffline(false);
      } else {
        throw new Error("heartbeat non-ok");
      }
    } catch {
      // Network error or server error
      const now = Date.now();
      const staleMs = lastSeenRef.current
        ? now - lastSeenRef.current
        : Infinity;
      setServerOffline(staleMs > STALE_THRESHOLD_MS);
    }
  };

  useEffect(() => {
    checkHeartbeat(); // immediate check on mount
    const id = setInterval(checkHeartbeat, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!serverOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white flex items-center gap-3 px-4 py-2.5 shadow-lg animate-in slide-in-from-top-2 duration-300"
    >
      <ServerCrash size={16} className="shrink-0" />
      <p className="text-sm font-semibold leading-snug">
        Library Server is offline. Data shown is read-only and may be out of date.
      </p>
    </div>
  );
}
