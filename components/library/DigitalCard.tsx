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
}

function formatCardDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
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
  address,
  phone,
  side = "front",
  exportMode = false,
  cardId,
}: DigitalCardProps) {
  if (side === "back") {
    return (
      <CardBack
        cardNumber={cardNumber}
        expiryDate={expiryDate}
        qrUrl={qrUrl}
        address={address}
        phone={phone}
        exportMode={exportMode}
        cardId={cardId}
        studentId={studentId}
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
    active: "status-success",
    pending: "status-warning",
    suspended: "status-danger",
    expired: "status-neutral",
  };

  const formattedExpiry = formatCardDate(expiryDate);

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
        <div className="grid grid-cols-[74px_1fr_auto] items-stretch border-b border-foreground bg-[#0068b3] sm:grid-cols-[96px_1fr_auto]">
          <div className="flex items-center justify-center border-r border-foreground bg-[#ffdb00] p-1 sm:p-2">
            <div className="text-center leading-none text-[#005aa9]">
              <p className="text-xl font-black sm:text-3xl">STI</p>
              <p className="mt-1 text-[8px] font-bold tracking-[0.12em] sm:text-[10px]">ALABANG</p>
            </div>
          </div>
          <div className="flex items-center justify-center px-2 py-2 sm:py-3">
            <h2 className="text-center font-serif text-[clamp(20px,5vw,46px)] tracking-wide text-white">LIBRARY CARD</h2>
          </div>
          <div className="flex items-start justify-end p-1.5 sm:p-2">
            <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase sm:text-[10px]", statusConfig[status])}>
              {status}
            </span>
          </div>
        </div>

        <div className="grid h-[calc(100%-58px)] grid-cols-[112px_1fr_80px] gap-2 p-2.5 sm:h-[calc(100%-72px)] sm:grid-cols-[150px_1fr_102px] sm:gap-4 sm:p-4">
          <div className="flex flex-col justify-start">
            <div className="h-[128px] w-full overflow-hidden border border-foreground bg-card sm:h-[172px]">
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
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground sm:text-base">
                  PHOTO
                </div>
              )}
            </div>
            <div className="mt-2 border-t border-foreground pt-1 text-center">
              <p className="font-serif text-[10px] font-medium text-foreground sm:text-xs">ID Number</p>
              <p className="truncate font-mono text-[10px] font-semibold text-foreground sm:text-xs">{studentId}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-4 sm:gap-6">
            <FieldLine label="Name" value={fullName} />
            <FieldLine label="ID Number" value={studentId} />
            <FieldLine label="Program" value={department} />
            <FieldLine label="Valid Until" value={formattedExpiry} />
            <div className="text-right font-serif text-[9px] text-foreground sm:text-[10px]">Card No: {cardNumber}</div>
          </div>

          <div className="flex flex-col items-center justify-between">
            <div className="w-full border border-foreground bg-card p-1.5">
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
                <div className="flex h-[64px] w-full items-center justify-center sm:h-[92px]">
                  <QrCode className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="pt-1 text-center text-[9px] font-medium text-muted-foreground sm:text-[10px]">Scan for verification</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="border-b border-foreground pb-0.5 text-center">
        <p className="truncate font-serif text-[12px] text-foreground sm:text-[19px]">{value}</p>
      </div>
      <p className="pt-1 text-center font-serif text-[11px] text-foreground sm:text-[15px]">{label}</p>
    </div>
  );
}

function CardBack({
  cardNumber,
  expiryDate,
  qrUrl,
  address,
  phone,
  exportMode,
  cardId,
  studentId,
}: Pick<
  DigitalCardProps,
  "cardNumber" | "expiryDate" | "qrUrl" | "address" | "phone" | "exportMode" | "cardId" | "studentId"
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
        <div className="grid grid-cols-[74px_1fr] items-stretch border-b border-foreground bg-[#0068b3] sm:grid-cols-[96px_1fr]">
          <div className="flex items-center justify-center border-r border-foreground bg-[#ffdb00] p-1 sm:p-2">
            <div className="text-center leading-none text-[#005aa9]">
              <p className="text-xl font-black sm:text-3xl">STI</p>
              <p className="mt-1 text-[8px] font-bold tracking-[0.12em] sm:text-[10px]">ALABANG</p>
            </div>
          </div>
          <div className="flex items-center justify-center px-2 py-2 sm:py-3">
            <h3 className="text-center font-serif text-[clamp(19px,4.4vw,40px)] tracking-wide text-white">LIBRARY CARD</h3>
          </div>
        </div>

        <div className="grid h-[calc(100%-58px)] grid-rows-[auto_auto_1fr_auto] gap-2 p-2.5 sm:h-[calc(100%-72px)] sm:gap-3 sm:p-4">
          <div className="flex items-center justify-between border-b border-foreground pb-1">
             <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Student ID: <span className="font-mono">{studentId}</span></p>
             <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Card No: {cardNumber}</p>
          </div>
          <div className="grid gap-1.5">
            <div>
              <p className="text-[11px] font-medium text-foreground sm:text-xs">Address:</p>
              <div className="mt-1 flex min-h-[1.5rem] items-center border border-foreground bg-card px-2 py-0.5 text-[10px] sm:min-h-[1.75rem] sm:text-xs">
                {address || "N/A"}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-foreground sm:text-xs">Contact No:</p>
              <div className="mt-1 flex min-h-[1.5rem] items-center border border-foreground bg-card px-2 py-0.5 text-[10px] sm:min-h-[1.75rem] sm:text-xs">
                {phone || "N/A"}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-center font-serif text-[clamp(17px,3.4vw,31px)] font-semibold text-foreground">Important Reminders</h4>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 font-serif text-[10px] leading-relaxed text-foreground sm:mt-2 sm:space-y-1 sm:pl-6 sm:text-[13px]">
              <li>This card is non-transferable.</li>
              <li>Present this card every time you borrow books and other library materials.</li>
              <li>Surrender this card at the end of the semester for clearance.</li>
            </ol>
          </div>

          <div className="grid grid-cols-[auto_1fr] items-end gap-2 sm:gap-4">
            <div className="flex items-end gap-2">
              <div className="border border-foreground bg-card p-1">
                {qrUrl ? (
                  <Image
                    src={qrUrl}
                    alt={`QR code for ${cardNumber}`}
                    width={56}
                    height={56}
                    className="w-10 h-10 sm:w-14 sm:h-14 object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center sm:h-14 sm:w-14">
                    <QrCode className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
                  </div>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground sm:text-[10px]">Valid until {formatCardDate(expiryDate)}</p>
            </div>

            <div className="justify-self-end">
              <div className="min-w-[100px] border-t border-foreground text-center sm:min-w-[140px]">
                <p className="pt-1 font-serif text-[11px] text-foreground sm:text-sm">Librarian</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
