"use client";

import { useEffect, useState } from "react";
import { WifiOff, X } from "lucide-react";

/**
 * Shows a sticky banner when the browser loses internet connectivity.
 * Listens to the native `online`/`offline` browser events.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Set initial state from navigator
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false); // re-show if connectivity returns then drops again
    };
    const handleOffline = () => {
      setIsOffline(true);
      setDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-amber-950 flex items-center justify-between gap-3 px-4 py-2.5 shadow-lg animate-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <WifiOff size={16} className="shrink-0" />
        <p className="text-sm font-semibold leading-snug truncate">
          You are offline. Search is disabled, but you can view your digital
          library card and currently borrowed books.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline notice"
        className="shrink-0 p-1 rounded hover:bg-amber-600/30 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
