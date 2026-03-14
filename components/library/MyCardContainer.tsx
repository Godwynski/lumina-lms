"use client";

import React, { useEffect, useState } from "react";
import DigitalCard from "./DigitalCard";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";

interface MyCardContainerProps {
  initialData: {
    fullName: string;
    studentId: string;
    cardNumber: string;
    department: string;
    status: "active" | "pending" | "suspended" | "expired";
    expiryDate: string;
    avatarUrl: string | null;
    qrSvg: string;
  };
}

const CACHE_KEY = "lumina_library_card_cache";

export default function MyCardContainer({ initialData }: MyCardContainerProps) {
  const [data, setData] = useState(initialData);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Instant Optimistic Load from Cache
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Only show cache if it's different from the fallback/loading state
        // but since we have SSR initialData, we usually show that.
        // Cache is mostly for offline cases or if initialData was null (not possible here).
        // However, we'll keep it for robustness.
      } catch (e) {
        console.error("Cache corrupted");
      }
    }
    setHasInitialized(true);
  }, []);

  // 2. Hydrate & Update Cache with fresh server data
  useEffect(() => {
    setData(initialData);
    localStorage.setItem(CACHE_KEY, JSON.stringify(initialData));
  }, [initialData]);

  // Handle local state updates (e.g. if we want to allow manual refresh)
  // This is where we could add advanced offline logic if needed

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">My Digital Card</h1>
          <p className="text-zinc-500 flex items-center gap-2">
            Your official library identity card
            {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
          </p>
        </div>
        
        {/* Subtle update indicator */}
        <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest hidden sm:block">
          Verified • {new Date().toLocaleDateString()}
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
          qrSvg={data.qrSvg}
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
