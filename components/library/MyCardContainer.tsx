"use client";

import { useEffect, useState } from "react";
import DigitalCard from "./DigitalCard";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Download, RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    address?: string;
    phone?: string;
  };
  variant?: "page" | "dashboard";
}

const SHOW_ASSET_REFRESH =
  process.env.NEXT_PUBLIC_SHOW_CARD_ASSET_REFRESH === "true";

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

export default function MyCardContainer({ initialData, variant = "page" }: MyCardContainerProps) {
  const [data, setData] = useState(initialData);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate with fresh server data
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Client short-circuit check for existing static assets
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

  if (variant === "dashboard") {
    return (
      <div className="w-full relative group/dashboard">
        {/* Subtle Background Glow */}
        <div className="absolute -inset-4 bg-primary/5 rounded-[2rem] blur-2xl opacity-0 group-hover/dashboard:opacity-100 transition-opacity pointer-events-none" />
        
        <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="mb-1 bg-primary/20 text-primary border-none text-[10px] font-bold uppercase tracking-widest px-2.5 h-6">Official Library ID</Badge>
            <h1 className="text-xl font-black tracking-tight text-foreground/90 uppercase">{data.fullName}</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setShowBack((prev) => !prev)}
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-[10px] font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {showBack ? "Front" : "Back"}
            </Button>

            <Button
              type="button"
              onClick={exportCardAsImage}
              disabled={isExporting}
              size="sm"
              className="h-8 gap-1.5 text-[10px] font-bold"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "..." : "Export"}
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <div id="library-card-front" className={cn("transition-all duration-300", showBack ? "opacity-0 invisible absolute inset-0" : "opacity-100 visible relative")}>
            <DigitalCard
              fullName={data.fullName}
              studentId={data.studentId}
              cardNumber={data.cardNumber}
              department={data.department}
              status={data.status}
              expiryDate={data.expiryDate}
              avatarUrl={data.avatarUrl}
              qrUrl={data.qrUrl}
              address={data.address}
              phone={data.phone}
              side="front"
            />
          </div>

          <div id="library-card-back" className={cn("transition-all duration-300", !showBack ? "opacity-0 invisible absolute inset-0" : "opacity-100 visible relative")}>
            <DigitalCard
              fullName={data.fullName}
              studentId={data.studentId}
              cardNumber={data.cardNumber}
              department={data.department}
              status={data.status}
              expiryDate={data.expiryDate}
              avatarUrl={data.avatarUrl}
              qrUrl={data.qrUrl}
              address={data.address}
              phone={data.phone}
              side="back"
            />
          </div>

          {/* Export Hidden Layer */}
          <div className="fixed left-[-12000px] top-0 pointer-events-none opacity-0" aria-hidden>
             {/* ... export logic remains same ... */}
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
                address={data.address}
                phone={data.phone}
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
                address={data.address}
                phone={data.phone}
                side="back"
                exportMode
                cardId="library-card-back-export-card"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Digital Card</h1>
          <p className="text-sm text-muted-foreground">STI College Alabang official library identity card</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col sm:items-end">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              type="button"
              onClick={() => setShowBack((prev) => !prev)}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none text-[11px] font-semibold sm:whitespace-nowrap sm:min-w-[132px]"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {showBack ? "Show front" : "Show back"}
            </Button>

            <Button
              type="button"
              onClick={exportCardAsImage}
              disabled={isExporting}
              size="sm"
              className="flex-1 sm:flex-none text-[11px] font-semibold sm:whitespace-nowrap sm:min-w-[132px]"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {isExporting ? "Exporting..." : "Export front + back"}
            </Button>

            <Button
              type="button"
              onClick={exportWalletPreset}
              disabled={isExporting}
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none text-[11px] font-semibold sm:whitespace-nowrap sm:min-w-[132px]"
            >
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Wallet preset
            </Button>

            {SHOW_ASSET_REFRESH && (
              <Button
                type="button"
                onClick={refreshAssets}
                disabled={isRefreshingAssets}
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex text-[11px] font-semibold sm:whitespace-nowrap sm:min-w-[132px]"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {isRefreshingAssets ? "Refreshing..." : "Refresh assets"}
              </Button>
            )}
          </div>

          <div className="hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:block">
            Verified • {mounted ? new Date().toLocaleDateString("en-US") : "..."}
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
            address={data.address}
            phone={data.phone}
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
            address={data.address}
            phone={data.phone}
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
              address={data.address}
              phone={data.phone}
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
              address={data.address}
              phone={data.phone}
              side="back"
              exportMode
              cardId="library-card-back-export-card"
            />
          </div>
        </div>
      </motion.div>

      <p className="mt-2 text-[11px] text-muted-foreground sm:hidden">
        Tip: Rotate your phone to landscape for the best card preview.
      </p>



      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">Quick Guide</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-foreground">1</span>
            Present this QR code to the librarian during checkout.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-foreground">2</span>
            Back side now focuses on essential borrowing, returning, and support information.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-foreground">3</span>
            Export options include front+back composite and wallet-size preset (1012x638 px).
          </li>

        </ul>
      </div>
    </div>
  );
}
