"use client";

import { useEffect, useRef, useState } from "react";
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
    // If browser itself is offline, suppress this server-health banner.
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
  }, []);

  if (!serverOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="status-danger fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-md px-3 py-1.5 shadow-sm animate-in slide-in-from-top-2 duration-300"
    >
      <p className="text-xs font-semibold leading-snug">Library server is offline.</p>
    </div>
  );
}
