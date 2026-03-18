"use client";

import { useEffect, useState } from "react";
import DigitalCard from "./DigitalCard";
import { motion } from "framer-motion";

interface MyCardContainerProps {
  initialData: {
    fullName: string;
    studentId: string;
    cardNumber: string;
    department: string;
    status: "active" | "pending" | "suspended" | "expired";
    expiryDate: string;
    avatarUrl: string | null;
    qrUrl: string | null;
  };
}

const CACHE_KEY = "lumina_library_card_cache";
const SHOW_ASSET_REFRESH =
  process.env.NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH === "true";

type AssetStatusResponse = {
  qr_url: string;
  profile_url: string;
  qr_exists: boolean;
  profile_exists: boolean;
  ready: boolean;
};

export default function MyCardContainer({ initialData }: MyCardContainerProps) {
  const [data, setData] = useState(initialData);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  // 1. Instant Optimistic Load from Cache
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        JSON.parse(cached);
      } catch {
        console.error("Cache corrupted");
      }
    }
  }, []);

  // 2. Hydrate & Update Cache with fresh server data
  useEffect(() => {
    setData(initialData);
    localStorage.setItem(CACHE_KEY, JSON.stringify(initialData));
  }, [initialData]);

  // 3. Client short-circuit check for existing static assets
  useEffect(() => {
    let mounted = true;

    const checkAssets = async () => {
      try {
        const response = await fetch("/api/my-card/assets-status", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const status = (await response.json()) as AssetStatusResponse;
        if (!mounted) return;

        setData((current) => {
          const nextQrUrl = status.qr_exists ? status.qr_url : current.qrUrl;
          const nextAvatarUrl =
            status.profile_exists && status.profile_url
              ? status.profile_url
              : current.avatarUrl;

          if (nextQrUrl === current.qrUrl && nextAvatarUrl === current.avatarUrl) {
            return current;
          }

          const updated = {
            ...current,
            qrUrl: nextQrUrl,
            avatarUrl: nextAvatarUrl,
          };

          localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
          return updated;
        });
      } catch {
        // Fallback to current static URLs if status endpoint fails.
      }
    };

    checkAssets();

    return () => {
      mounted = false;
    };
  }, []);

  // Handle local state updates (e.g. if we want to allow manual refresh)
  // This is where we could add advanced offline logic if needed

  const refreshAssets = async () => {
    setIsRefreshingAssets(true);
    try {
      const response = await fetch("/api/my-card/assets-refresh", {
        method: "POST",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        qr_url?: string;
        profile_url?: string | null;
      };

      setData((current) => {
        const next = {
          ...current,
          qrUrl: payload.qr_url || current.qrUrl,
          avatarUrl: payload.profile_url || current.avatarUrl,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
    } finally {
      setIsRefreshingAssets(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">My Digital Card</h1>
          <p className="text-zinc-500">Your official library identity card</p>
        </div>

        <div className="flex items-center gap-3">
          {SHOW_ASSET_REFRESH && (
            <button
              type="button"
              onClick={refreshAssets}
              disabled={isRefreshingAssets}
              className="hidden sm:inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
            >
              {isRefreshingAssets ? "Refreshing..." : "Refresh assets"}
            </button>
          )}

          <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest hidden sm:block">
            Verified • {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <DigitalCard
          fullName={data.fullName}
          studentId={data.studentId}
          cardNumber={data.cardNumber}
          department={data.department}
          status={data.status}
          expiryDate={data.expiryDate}
          avatarUrl={data.avatarUrl}
          qrUrl={data.qrUrl}
        />
      </motion.div>



      <div className="mt-12 bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-4">Quick Guide</h3>
        <ul className="space-y-3 text-sm text-zinc-600">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">1</span>
            Present this QR code to the librarian during checkout.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">2</span>
            This card is cached locally for instant offline access.
          </li>

        </ul>
      </div>
    </div>
  );
}
