"use client";

import { useEffect, useState } from "react";
import DigitalCard from "./DigitalCard";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Download, RefreshCw, RotateCcw, Wallet } from "lucide-react";

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

type CardData = MyCardContainerProps["initialData"];

const CACHE_KEY = "lumina_library_card_cache";
const SHOW_ASSET_REFRESH =
  process.env.NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH === "true";

const actionBaseClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const desktopActionClass =
  "sm:whitespace-nowrap sm:min-w-[132px]";

const EXPORT_CARD_WIDTH = 560;
const EXPORT_CARD_HEIGHT = 353;
const WALLET_EXPORT_WIDTH = 1012;
const WALLET_EXPORT_HEIGHT = 638;

const isHiddenForCapture = (node: HTMLElement) => {
  const style = window.getComputedStyle(node);
  return style.display === "none" || style.visibility === "hidden";
};

const captureCardPng = async (node: HTMLElement) => {
  const previousDisplay = node.style.display;
  const hidden = isHiddenForCapture(node);
  if (hidden) {
    node.style.display = "block";
  }

  try {
    return await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#ffffff",
      width: EXPORT_CARD_WIDTH,
      height: EXPORT_CARD_HEIGHT,
      canvasWidth: EXPORT_CARD_WIDTH * 2,
      canvasHeight: EXPORT_CARD_HEIGHT * 2,
      style: {
        margin: "0",
        padding: "0",
        width: `${EXPORT_CARD_WIDTH}px`,
        height: `${EXPORT_CARD_HEIGHT}px`,
        transform: "none",
      },
    });
  } finally {
    if (hidden) {
      node.style.display = previousDisplay;
    }
  }
};

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
  const [isExporting, setIsExporting] = useState(false);
  const [showBack, setShowBack] = useState(false);

  // 1. Instant Optimistic Load from Cache
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Partial<CardData>;
        if (
          typeof parsed.fullName === "string" &&
          typeof parsed.studentId === "string" &&
          typeof parsed.cardNumber === "string" &&
          typeof parsed.department === "string" &&
          typeof parsed.expiryDate === "string" &&
          (parsed.status === "active" ||
            parsed.status === "pending" ||
            parsed.status === "suspended" ||
            parsed.status === "expired")
        ) {
          setData((current) => ({
            ...current,
            ...parsed,
          }));
        }
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
          qrUrl: payload.qr_url ?? current.qrUrl,
          avatarUrl: payload.profile_url ?? current.avatarUrl,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        return next;
      });
    } finally {
      setIsRefreshingAssets(false);
    }
  };

  const exportCardAsImage = async () => {
    const frontCardEl = document.getElementById("library-card-front-export-card");
    const backCardEl = document.getElementById("library-card-back-export-card");
    if (!frontCardEl || !backCardEl || isExporting) return;

    setIsExporting(true);
    try {
      const [frontUrl, backUrl] = await Promise.all([
        captureCardPng(frontCardEl),
        captureCardPng(backCardEl),
      ]);

      const frontImage = new window.Image();
      const backImage = new window.Image();

      const frontLoaded = new Promise<void>((resolve, reject) => {
        frontImage.onload = () => resolve();
        frontImage.onerror = () => reject(new Error("Failed to load front image"));
      });

      const backLoaded = new Promise<void>((resolve, reject) => {
        backImage.onload = () => resolve();
        backImage.onerror = () => reject(new Error("Failed to load back image"));
      });

      frontImage.src = frontUrl;
      backImage.src = backUrl;

      await Promise.all([frontLoaded, backLoaded]);

      const cardWidth = WALLET_EXPORT_WIDTH;
      const cardHeight = WALLET_EXPORT_HEIGHT;
      const gap = 20;
      const padding = 16;
      const canvas = document.createElement("canvas");
      canvas.width = cardWidth * 2 + gap + padding * 2;
      canvas.height = cardHeight + padding * 2;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize export canvas");

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#f2f7ff");
      gradient.addColorStop(0.5, "#ffffff");
      gradient.addColorStop(1, "#eefaf4");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(frontImage, padding, padding, cardWidth, cardHeight);
      ctx.drawImage(
        backImage,
        padding + cardWidth + gap,
        padding,
        cardWidth,
        cardHeight
      );

      const dataUrl = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      const fileSafeName = data.fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      link.href = dataUrl;
      link.download = `sti-alabang-library-card-${fileSafeName || data.studentId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // No-op fallback for export failures.
    } finally {
      setIsExporting(false);
    }
  };

  const exportWalletPreset = async () => {
    const frontCardEl = document.getElementById("library-card-front-export-card");
    if (!frontCardEl || isExporting) return;

    setIsExporting(true);
    try {
      const frontUrl = await captureCardPng(frontCardEl);

      const frontImage = new window.Image();
      await new Promise<void>((resolve, reject) => {
        frontImage.onload = () => resolve();
        frontImage.onerror = () => reject(new Error("Failed to load front image"));
        frontImage.src = frontUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = WALLET_EXPORT_WIDTH;
      canvas.height = WALLET_EXPORT_HEIGHT;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize wallet export canvas");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, WALLET_EXPORT_WIDTH, WALLET_EXPORT_HEIGHT);
      ctx.drawImage(frontImage, 0, 0, WALLET_EXPORT_WIDTH, WALLET_EXPORT_HEIGHT);

      const dataUrl = canvas.toDataURL("image/png");

      const fileSafeName = data.fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `sti-wallet-front-1012x638-${fileSafeName || data.studentId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // No-op fallback for export failures.
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">My Digital Card</h1>
          <p className="text-zinc-500">STI College Alabang official library identity card</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col sm:items-end">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setShowBack((prev) => !prev)}
              className={`${actionBaseClass} ${desktopActionClass} flex-1 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 sm:flex-none`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {showBack ? "Show front" : "Show back"}
            </button>

            <button
              type="button"
              onClick={exportCardAsImage}
              disabled={isExporting}
              className={`${actionBaseClass} ${desktopActionClass} flex-1 border-blue-700 bg-blue-700 text-white hover:bg-blue-800 sm:flex-none`}
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "Exporting..." : "Export front + back"}
            </button>

            <button
              type="button"
              onClick={exportWalletPreset}
              disabled={isExporting}
              className={`${actionBaseClass} ${desktopActionClass} flex-1 border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 sm:flex-none`}
            >
              <Wallet className="h-3.5 w-3.5" />
              Wallet preset
            </button>

            {SHOW_ASSET_REFRESH && (
              <button
                type="button"
                onClick={refreshAssets}
                disabled={isRefreshingAssets}
                className={`${actionBaseClass} ${desktopActionClass} hidden border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 sm:inline-flex`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {isRefreshingAssets ? "Refreshing..." : "Refresh assets"}
              </button>
            )}
          </div>

          <div className="hidden text-[10px] font-bold uppercase tracking-widest text-zinc-300 sm:block">
            Verified • {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div id="library-card-front" className={showBack ? "hidden" : "block"}>
          <DigitalCard
            fullName={data.fullName}
            studentId={data.studentId}
            cardNumber={data.cardNumber}
            department={data.department}
            status={data.status}
            expiryDate={data.expiryDate}
            avatarUrl={data.avatarUrl}
            qrUrl={data.qrUrl}
            side="front"
          />
        </div>

        <div id="library-card-back" className={showBack ? "block" : "hidden"}>
          <DigitalCard
            fullName={data.fullName}
            studentId={data.studentId}
            cardNumber={data.cardNumber}
            department={data.department}
            status={data.status}
            expiryDate={data.expiryDate}
            avatarUrl={data.avatarUrl}
            qrUrl={data.qrUrl}
            side="back"
          />
        </div>

        <div className="fixed left-[-12000px] top-0 pointer-events-none opacity-0" aria-hidden>
          <div className="h-[353px] w-[560px] p-0 m-0 overflow-hidden">
            <DigitalCard
              fullName={data.fullName}
              studentId={data.studentId}
              cardNumber={data.cardNumber}
              department={data.department}
              status={data.status}
              expiryDate={data.expiryDate}
              avatarUrl={data.avatarUrl}
              qrUrl={data.qrUrl}
              side="front"
              exportMode
              cardId="library-card-front-export-card"
            />
          </div>
          <div className="h-[353px] w-[560px] p-0 m-0 overflow-hidden">
            <DigitalCard
              fullName={data.fullName}
              studentId={data.studentId}
              cardNumber={data.cardNumber}
              department={data.department}
              status={data.status}
              expiryDate={data.expiryDate}
              avatarUrl={data.avatarUrl}
              qrUrl={data.qrUrl}
              side="back"
              exportMode
              cardId="library-card-back-export-card"
            />
          </div>
        </div>
      </motion.div>

      <p className="mt-2 text-[11px] text-zinc-500 sm:hidden">
        Tip: Rotate your phone to landscape for the best card preview.
      </p>



      <div className="mt-12 bg-zinc-50 border border-zinc-100 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-widest mb-4">Quick Guide</h3>
        <ul className="space-y-3 text-sm text-zinc-600">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">1</span>
            Present this QR code to the librarian during checkout.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">2</span>
            Back side now focuses on essential borrowing, returning, and support information.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">3</span>
            Export options include front+back composite and wallet-size preset (1012x638 px).
          </li>

        </ul>
      </div>
    </div>
  );
}
