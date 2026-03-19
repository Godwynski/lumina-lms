"use client";

import {
  GraduationCap,
  Calendar,
  ShieldCheck,
  MapPin,
  LibraryBig,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  LifeBuoy,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface DigitalCardProps {
  fullName: string;
  studentId: string;
  cardNumber: string;
  department: string;
  status: "active" | "pending" | "suspended" | "expired";
  expiryDate: string;
  avatarUrl?: string | null;
  qrUrl?: string | null;
  side?: "front" | "back";
  exportMode?: boolean;
  cardId?: string;
}

function formatCardDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DigitalCard({
  fullName,
  studentId,
  cardNumber,
  department,
  status,
  expiryDate,
  avatarUrl,
  qrUrl,
  side = "front",
  exportMode = false,
  cardId,
}: DigitalCardProps) {
  if (side === "back") {
    return (
      <CardBack
        cardNumber={cardNumber}
        expiryDate={expiryDate}
        exportMode={exportMode}
        cardId={cardId}
      />
    );
  }

  return (
    <CardFront
      fullName={fullName}
      studentId={studentId}
      cardNumber={cardNumber}
      department={department}
      status={status}
      expiryDate={expiryDate}
      avatarUrl={avatarUrl}
      qrUrl={qrUrl}
      exportMode={exportMode}
      cardId={cardId}
    />
  );
}

function CardFront({
  fullName,
  studentId,
  cardNumber,
  department,
  status,
  expiryDate,
  avatarUrl,
  qrUrl,
  exportMode,
  cardId,
}: Omit<DigitalCardProps, "side">) {
  const statusConfig = {
    active: "bg-emerald-500/15 text-emerald-700 border-emerald-400/40",
    pending: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    suspended: "bg-red-500/15 text-red-700 border-red-400/40",
    expired: "bg-zinc-500/15 text-zinc-700 border-zinc-400/40",
  };

  const formattedExpiry = formatCardDate(expiryDate);

  return (
    <div className={cn("flex w-full items-center justify-center", exportMode ? "p-0" : "p-1 sm:p-3")}>
      <div
        id={cardId}
        className={cn(
          "relative overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(115deg,#e8f2ff_0%,#f7fbff_34%,#fff8e7_68%,#e8fff4_100%)] shadow-[0_20px_60px_rgba(16,24,40,0.18)]",
          exportMode ? "max-w-none" : "aspect-[1.586/1] w-full max-w-[560px]"
        )}
        style={exportMode ? { width: 560, height: 353 } : undefined}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(37,99,235,0.23),transparent_38%),radial-gradient(circle_at_94%_88%,rgba(16,185,129,0.15),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background:linear-gradient(120deg,transparent_0%,transparent_44%,rgba(255,255,255,0.7)_50%,transparent_56%,transparent_100%)]" />

        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-bl-[36px] border-l border-b border-blue-200/60 bg-blue-400/10" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-tr-[30px] border-r border-t border-emerald-200/70 bg-emerald-300/10" />

        <div className="relative z-10 flex h-full flex-col p-3 sm:p-6">
          <div className="mb-3 flex items-start justify-between sm:mb-4">
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-blue-300/50 bg-blue-600/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-900 sm:gap-2 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em]">
                <LibraryBig className="h-3.5 w-3.5" /> STI College Alabang
              </div>
              <h2 className="text-[17px] font-black leading-tight tracking-tight text-zinc-900 sm:text-[28px]">
                Library Access Card
              </h2>
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600 sm:block">
                Student Identity Credential
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  statusConfig[status]
                )}
              >
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "active" ? "animate-pulse bg-emerald-500" : "bg-current"
                  )}
                />
                {status}
              </div>
              <div className="max-w-[140px] truncate rounded-full border border-zinc-200/80 bg-white/80 px-2 py-0.5 text-[9px] font-mono text-zinc-700 sm:max-w-none sm:text-[10px]">
                {cardNumber}
              </div>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-[1fr_auto] gap-3 sm:gap-6">
            <div className="min-w-0 space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-zinc-100 shadow-lg sm:h-20 sm:w-20">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={fullName}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black text-zinc-400">
                      {fullName?.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-[10px] sm:tracking-[0.2em]">
                    Card Holder
                  </p>
                  <p className="truncate text-sm font-black leading-tight text-zinc-900 sm:text-xl">
                    {fullName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl border border-zinc-200/70 bg-white/65 p-2 sm:p-3">
                  <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500 sm:gap-1.5 sm:text-[10px]">
                    <GraduationCap className="h-3.5 w-3.5 text-blue-600" /> Student ID
                  </div>
                  <p className="truncate text-[10px] font-mono font-bold text-zinc-900 sm:text-sm">{studentId}</p>
                </div>

                <div className="rounded-xl border border-zinc-200/70 bg-white/65 p-2 sm:p-3">
                  <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500 sm:gap-1.5 sm:text-[10px]">
                    <MapPin className="h-3.5 w-3.5 text-cyan-700" /> Department
                  </div>
                  <p className="truncate text-[10px] font-bold text-zinc-900 sm:text-sm">{department}</p>
                </div>
              </div>
            </div>

            <div className="flex w-[86px] shrink-0 flex-col items-center justify-between rounded-2xl border border-zinc-200/70 bg-white/80 p-2 sm:w-[124px] sm:p-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-1 shadow-inner sm:p-1.5">
                {qrUrl ? (
                  <Image
                    src={qrUrl}
                    alt={`QR code for ${cardNumber}`}
                    width={96}
                    height={96}
                    className="h-16 w-16 sm:h-24 sm:w-24"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-16 w-16 animate-pulse items-center justify-center bg-zinc-50 sm:h-24 sm:w-24">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-400" />
                  </div>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-zinc-600 sm:mt-2 sm:text-[10px]">
                <Sparkles className="h-3 w-3" /> Scan to verify
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-zinc-300/60 pt-2 sm:mt-4 sm:pt-3">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-700 sm:gap-2 sm:text-[11px]">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              Expires: <span className="font-black text-zinc-900">{formattedExpiry}</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[8px] font-semibold uppercase tracking-wider text-zinc-100 sm:gap-1.5 sm:px-2.5 sm:text-[10px]">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Identity
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardBack({
  cardNumber,
  expiryDate,
  exportMode,
  cardId,
}: Pick<
  DigitalCardProps,
  "cardNumber" | "expiryDate" | "exportMode" | "cardId"
>) {
  return (
    <div className={cn("flex w-full items-center justify-center", exportMode ? "p-0" : "p-1 sm:p-3")}>
      <div
        id={cardId}
        className={cn(
          "relative overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(115deg,#e8f2ff_0%,#f7fbff_34%,#fff8e7_68%,#e8fff4_100%)] shadow-[0_20px_60px_rgba(16,24,40,0.18)]",
          exportMode ? "max-w-none" : "aspect-[1.586/1] w-full max-w-[560px]"
        )}
        style={exportMode ? { width: 560, height: 353 } : undefined}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(37,99,235,0.23),transparent_38%),radial-gradient(circle_at_94%_88%,rgba(16,185,129,0.15),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background:linear-gradient(120deg,transparent_0%,transparent_44%,rgba(255,255,255,0.7)_50%,transparent_56%,transparent_100%)]" />

        <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-bl-[36px] border-l border-b border-blue-200/60 bg-blue-400/10" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-tr-[30px] border-r border-t border-emerald-200/70 bg-emerald-300/10" />

        <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-2 p-3 sm:gap-2.5 sm:p-4 text-zinc-900">
          <div className="flex items-start justify-between">
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-blue-300/50 bg-blue-600/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-blue-900 sm:gap-2 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em]">
                <LibraryBig className="h-3.5 w-3.5" /> STI College Alabang
              </div>
              <h3 className="text-[17px] font-black leading-tight tracking-tight sm:text-[26px]">Library Process Guide</h3>
            </div>
            <div className="max-w-[140px] truncate rounded-full border border-zinc-200/80 bg-white/80 px-2 py-0.5 text-[9px] font-mono text-zinc-700 sm:max-w-none sm:text-[10px]">
              {cardNumber}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/75 p-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-[10px] sm:tracking-[0.18em]">
                Borrowing
              </p>
              <div className="mt-1 space-y-1 text-[10px] font-semibold leading-tight text-zinc-800">
                <p className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-blue-600" /> Pick book</p>
                <p className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-blue-600" /> Show card QR</p>
                <p className="flex items-center gap-1"><ArrowRight className="h-3 w-3 text-blue-600" /> Scan and confirm</p>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/75 p-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-[10px] sm:tracking-[0.18em]">
                Returning
              </p>
              <div className="mt-1 space-y-1 text-[10px] font-semibold leading-tight text-zinc-800">
                <p className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-emerald-600" /> Bring to desk</p>
                <p className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-emerald-600" /> Scan book QR</p>
                <p className="flex items-center gap-1"><RotateCcw className="h-3 w-3 text-emerald-600" /> Clear record</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200/80 bg-amber-50/75 p-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-[10px] sm:tracking-[0.18em]">
                Important
              </p>
              <div className="mt-1 space-y-1 text-[10px] font-semibold leading-tight text-zinc-800">
                <p className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" /> Non-transferable</p>
                <p className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" /> Keep QR readable</p>
                <p className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-600" /> Report loss fast</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/75 p-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500 sm:text-[10px] sm:tracking-[0.18em]">
                Support
              </p>
              <div className="mt-1 space-y-1 text-[10px] font-semibold leading-tight text-zinc-800">
                <p className="flex items-center gap-1"><LifeBuoy className="h-3 w-3 text-slate-600" /> Library Services Office</p>
                <p className="flex items-center gap-1"><LifeBuoy className="h-3 w-3 text-slate-600" /> STI College Alabang</p>
                <p className="flex items-center gap-1"><LifeBuoy className="h-3 w-3 text-slate-600" /> Bring ID for help</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-300/60 bg-white/80 px-2.5 py-1.5 text-[9px] font-semibold tracking-[0.06em] text-zinc-700 sm:px-3 sm:py-2 sm:text-[11px] sm:tracking-[0.08em]">
            Valid until {formatCardDate(expiryDate)} • Non-transferable credential
          </div>
        </div>
      </div>
    </div>
  );
}
