"use client";

import {
  QrCode,
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
  address?: string;
  phone?: string;
  side?: "front" | "back";
  exportMode?: boolean;
  cardId?: string;
  academicYear?: string;
  roleLabel?: string;
  onQrClick?: () => void;
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
  address,
  phone,
  side = "front",
  exportMode = false,
  cardId,
  academicYear,
  roleLabel,
  onQrClick,
}: DigitalCardProps) {
  if (side === "back") {
    return (
      <CardBack
        address={address}
        phone={phone}
        exportMode={exportMode}
        cardId={cardId}
        roleLabel={roleLabel}
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
      academicYear={academicYear}
      onQrClick={onQrClick}
    />
  );
}

function CardFront({
  fullName,
  cardNumber,
  department,
  status,
  avatarUrl,
  qrUrl,
  exportMode,
  cardId,
  academicYear,
  onQrClick,
}: Omit<DigitalCardProps, "side">) {
  const statusConfig = {
    active: "status-success",
    pending: "status-warning",
    suspended: "status-danger",
    expired: "status-neutral",
  };


  return (
    <div className={cn("flex w-full items-center justify-center", exportMode ? "p-0" : "p-1 sm:p-3")}>
      <div
        id={cardId}
        className={cn(
          "relative overflow-hidden rounded-none border border-foreground bg-[#e6e6e6]",
          exportMode ? "max-w-none shadow-none" : "min-h-[260px] sm:min-h-[auto] sm:aspect-[1.586/1] w-full max-w-[560px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
        )}
        style={exportMode ? { width: 560, height: 353 } : undefined}
      >
        <div className={cn(
          "grid items-stretch border-b border-foreground bg-[#0068b3]",
          exportMode ? "grid-cols-[96px_1fr_auto]" : "grid-cols-[64px_1fr_auto] sm:grid-cols-[96px_1fr_auto]"
        )}>
          <div className={cn(
            "flex items-center justify-center border-r border-foreground bg-[#ffdb00]",
            exportMode ? "p-2" : "p-1 sm:p-2"
          )}>
            <div className="text-center leading-none text-[#005aa9]">
              <p className={cn("font-black", exportMode ? "text-3xl" : "text-lg sm:text-3xl")}>STI</p>
              <p className={cn("mt-0.5 font-bold tracking-[0.12em]", exportMode ? "text-[10px]" : "text-[7px] sm:text-[10px]")}>ALABANG</p>
            </div>
          </div>
          <div className={cn("flex items-center justify-center px-2", exportMode ? "py-3" : "py-2 sm:py-3")}>
            <h2 className={cn("text-center font-sans font-bold tracking-tight text-white", exportMode ? "text-[26px]" : "text-[clamp(18px,3.5vw,30px)]")}>LIBRARY CARD</h2>
          </div>
          <div className={cn("flex items-start justify-end", exportMode ? "p-2" : "p-1.5 sm:p-2")}>
            {status !== "active" && (
              <span className={cn("inline-flex rounded border font-semibold uppercase", exportMode ? "px-1.5 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px] sm:text-[10px]", statusConfig[status])}>
                {status}
              </span>
            )}
          </div>
        </div>

        <div className={cn(
          "grid gap-2 p-2",
          exportMode 
            ? "h-[calc(100%-72px)] grid-cols-[150px_1fr_102px] gap-4 p-4" 
            : "h-[calc(100%-52px)] grid-cols-[80px_1fr_68px] sm:h-[calc(100%-72px)] sm:grid-cols-[150px_1fr_102px] sm:gap-4 sm:p-4"
        )}>
          <div className="flex flex-col justify-start">
            <div className={cn(
              "w-full overflow-hidden border border-foreground bg-card",
              exportMode ? "h-[172px]" : "h-[110px] sm:h-[172px]"
            )}>
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  width={150}
                  height={172}
                  className="h-full w-full object-cover"
                  priority
                  unoptimized
                />
              ) : (
                <div className={cn(
                  "flex h-full w-full items-center justify-center font-semibold text-muted-foreground",
                  exportMode ? "text-base" : "text-xs sm:text-base"
                )}>
                  PHOTO
                </div>
              )}
            </div>
          </div>

          <div className={cn("flex min-w-0 flex-col justify-center", exportMode ? "gap-5" : "gap-3 sm:gap-5")}>
            <FieldLine label="Name" value={fullName} exportMode={exportMode} />
            <FieldLine label="Program" value={department} exportMode={exportMode} />
            <FieldLine label="Academic Year" exportMode={exportMode} value={academicYear || (() => {
              const now = new Date();
              const currentYear = now.getUTCFullYear();
              // Standard AY: Usually starts around May/June.
              // If we are in May (4) or later, we likely mean the upcoming/new AY.
              const startYear = now.getUTCMonth() >= 4 ? currentYear : currentYear - 1;
              return `${startYear} - ${startYear + 1}`;
            })()} />
          </div>

          <div className={cn("flex flex-col items-center justify-start", exportMode ? "gap-2" : "gap-1.5 sm:gap-2")}>
            <button
              type="button"
              onClick={onQrClick}
              disabled={!onQrClick}
              aria-label="Expand QR code"
              className={cn(
                "w-full border border-foreground bg-card p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0068b3] rounded-none",
                onQrClick ? "cursor-pointer transition-all hover:scale-105 active:scale-95 hover:border-[#0068b3]" : "cursor-default"
              )}
            >
              {qrUrl ? (
                <Image
                  src={qrUrl}
                  alt={`QR code for ${cardNumber}`}
                  width={92}
                  height={92}
                  className="w-full h-auto object-contain"
                  unoptimized
                />
              ) : (
                <div className={cn("flex w-full items-center justify-center", exportMode ? "h-[92px]" : "h-[60px] sm:h-[92px]")}>
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </button>
            <div className="flex flex-col items-center leading-none">
              <p className={cn("font-mono font-black tracking-tighter text-foreground break-all text-center", exportMode ? "text-[14px]" : "text-[11px] sm:text-[14px]")}>{cardNumber}</p>
              <p className={cn("mt-0.5 text-center font-bold uppercase tracking-tight text-muted-foreground/80", exportMode ? "text-[8px]" : "text-[6px] sm:text-[8px]")}>Scan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLine({ label, value, exportMode }: { label: string; value: string; exportMode?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full border-b border-foreground/40 pb-0.5 text-center">
        <p className={cn(
          "font-sans font-bold leading-tight text-foreground whitespace-normal break-words line-clamp-2",
          exportMode ? "text-[18px]" : "text-[12px] sm:text-[16px] md:text-[18px]"
        )}>{value}</p>
      </div>
      <p className={cn(
        "pt-0.5 text-center font-sans font-bold uppercase tracking-widest text-muted-foreground/80",
        exportMode ? "text-[11px]" : "text-[9px] sm:text-[11px]"
      )}>{label}</p>
    </div>
  );
}

function CardBack({
  address,
  phone,
  exportMode,
  cardId,
  roleLabel,
}: Pick<
  DigitalCardProps,
  "address" | "phone" | "exportMode" | "cardId" | "roleLabel"
>) {
  return (
    <div className={cn("flex w-full items-center justify-center", exportMode ? "p-0" : "p-1 sm:p-3")}>
      <div
        id={cardId}
        className={cn(
          "relative overflow-hidden rounded-none border border-foreground bg-[#e6e6e6]",
          exportMode ? "max-w-none shadow-none" : "min-h-[260px] sm:min-h-[auto] sm:aspect-[1.586/1] w-full max-w-[560px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
        )}
        style={exportMode ? { width: 560, height: 353 } : undefined}
      >
        <div className={cn(
          "grid items-stretch border-b border-foreground bg-[#0068b3]",
          exportMode ? "grid-cols-[96px_1fr]" : "grid-cols-[64px_1fr] sm:grid-cols-[96px_1fr]"
        )}>
          <div className={cn(
            "flex items-center justify-center border-r border-foreground bg-[#ffdb00]",
            exportMode ? "p-2" : "p-1 sm:p-2"
          )}>
            <div className="text-center leading-none text-[#005aa9]">
              <p className={cn("font-black", exportMode ? "text-3xl" : "text-lg sm:text-3xl")}>STI</p>
              <p className={cn("mt-0.5 font-bold tracking-[0.12em]", exportMode ? "text-[10px]" : "text-[7px] sm:text-[10px]")}>ALABANG</p>
            </div>
          </div>
          <div className={cn("flex items-center justify-center px-2", exportMode ? "py-3" : "py-2 sm:py-3")}>
            <h3 className={cn("text-center font-sans font-bold tracking-tight text-white", exportMode ? "text-[26px]" : "text-[clamp(16px,4vw,32px)]")}>LIBRARY CARD</h3>
          </div>
        </div>

        <div className={cn(
          "grid grid-rows-[auto_1fr_auto] gap-2 p-2",
          exportMode 
            ? "h-[calc(100%-72px)] gap-3 p-4" 
            : "h-[calc(100%-52px)] sm:h-[calc(100%-72px)] sm:gap-3 sm:p-4"
        )}>
          <div className="grid gap-1.5">
            <div>
              <p className={cn("font-medium text-foreground", exportMode ? "text-xs" : "text-[11px] sm:text-xs")}>Address:</p>
              <div className={cn("mt-1 flex items-center border border-foreground bg-card px-2 py-0.5", exportMode ? "min-h-[1.75rem] text-xs" : "min-h-[1.5rem] text-[10px] sm:min-h-[1.75rem] sm:text-xs")}>
                {address || "N/A"}
              </div>
            </div>
            <div>
              <p className={cn("font-medium text-foreground", exportMode ? "text-xs" : "text-[11px] sm:text-xs")}>Contact No:</p>
              <div className={cn("mt-1 flex items-center border border-foreground bg-card px-2 py-0.5", exportMode ? "min-h-[1.75rem] text-xs" : "min-h-[1.5rem] text-[10px] sm:min-h-[1.75rem] sm:text-xs")}>
                {phone || "N/A"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h4 className={cn("text-center font-sans font-bold text-foreground", exportMode ? "text-[18px]" : "text-[clamp(14px,3vw,20px)]")}>Important Reminders</h4>
            <ol className={cn("list-decimal space-y-0.5 pl-5 font-sans leading-tight text-foreground", exportMode ? "pl-6 text-[11px]" : "sm:pl-6 text-[9px] sm:text-[11px]")}>
              <li>This card is non-transferable.</li>
              <li>Present this card every time you borrow books and other library materials.</li>
              <li>Surrender this card at the end of the semester for clearance.</li>
            </ol>
          </div>

          <div className="flex items-end justify-end">
            <div className="flex flex-col items-end pb-1">
              <div className={cn("border-b border-foreground text-center", exportMode ? "min-w-[140px]" : "min-w-[100px] sm:min-w-[140px]")}>
                <p className={cn("font-sans font-bold text-foreground", exportMode ? "text-sm" : "text-[11px] sm:text-sm")}>{roleLabel || "Librarian"}</p>
              </div>
              <p className="mt-0.5 text-[8px] uppercase tracking-widest text-muted-foreground/60">Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
