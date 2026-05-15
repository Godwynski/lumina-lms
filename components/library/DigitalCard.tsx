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
}: DigitalCardProps) {
  if (side === "back") {
    return (
      <CardBack
        cardNumber={cardNumber}
        address={address}
        phone={phone}
        exportMode={exportMode}
        cardId={cardId}
        studentId={studentId}
        academicYear={academicYear}
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
        <div className="grid grid-cols-[64px_1fr_auto] items-stretch border-b border-foreground bg-[#0068b3] sm:grid-cols-[96px_1fr_auto]">
          <div className="flex items-center justify-center border-r border-foreground bg-[#ffdb00] p-1 sm:p-2">
            <div className="text-center leading-none text-[#005aa9]">
              <p className="text-lg font-black sm:text-3xl">STI</p>
              <p className="mt-0.5 text-[7px] font-bold tracking-[0.12em] sm:text-[10px]">ALABANG</p>
            </div>
          </div>
          <div className="flex items-center justify-center px-2 py-2 sm:py-3">
            <h2 className="text-center font-sans font-bold text-[clamp(20px,5vw,40px)] tracking-tight text-white">LIBRARY CARD</h2>
          </div>
          <div className="flex items-start justify-end p-1.5 sm:p-2">
            {status !== "active" && (
              <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase sm:text-[10px]", statusConfig[status])}>
                {status}
              </span>
            )}
          </div>
        </div>

        <div className="grid h-[calc(100%-52px)] grid-cols-[80px_1fr_68px] gap-2 p-2 sm:h-[calc(100%-72px)] sm:grid-cols-[150px_1fr_102px] sm:gap-4 sm:p-4">
          <div className="flex flex-col justify-start">
            <div className="h-[110px] w-full overflow-hidden border border-foreground bg-card sm:h-[172px]">
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
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground sm:text-base">
                  PHOTO
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-3 sm:gap-5">
            <FieldLine label="Name" value={fullName} />
            <FieldLine label="Program" value={department} />
            <FieldLine label="Academic Year" value={academicYear || (() => {
              const now = new Date();
              const currentYear = now.getUTCFullYear();
              // Standard AY: Usually starts around May/June.
              // If we are in May (4) or later, we likely mean the upcoming/new AY.
              const startYear = now.getUTCMonth() >= 4 ? currentYear : currentYear - 1;
              return `${startYear} - ${startYear + 1}`;
            })()} />
          </div>

          <div className="flex flex-col items-center justify-start gap-1.5 sm:gap-2">
            <div className="w-full border border-foreground bg-card p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]">
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
                <div className="flex h-[60px] w-full items-center justify-center sm:h-[92px]">
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center leading-none">
              <p className="font-mono text-[11px] font-black tracking-tighter text-foreground sm:text-[14px] break-all text-center">{cardNumber}</p>
              <p className="mt-0.5 text-center text-[6px] font-bold uppercase tracking-tight text-muted-foreground/80 sm:text-[8px]">Scan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-full border-b border-foreground/40 pb-0.5 text-center">
        <p className="font-sans text-[12px] font-bold leading-tight text-foreground sm:text-[20px] whitespace-normal break-words line-clamp-2">{value}</p>
      </div>
      <p className="pt-0.5 text-center font-sans text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 sm:text-[11px]">{label}</p>
    </div>
  );
}

function CardBack({
  cardNumber,
  address,
  phone,
  exportMode,
  cardId,
  studentId,
  academicYear,
  roleLabel,
}: Pick<
  DigitalCardProps,
  "cardNumber" | "address" | "phone" | "exportMode" | "cardId" | "studentId" | "academicYear" | "roleLabel"
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
        <div className="grid grid-cols-[64px_1fr] items-stretch border-b border-foreground bg-[#0068b3] sm:grid-cols-[96px_1fr]">
          <div className="flex items-center justify-center border-r border-foreground bg-[#ffdb00] p-1 sm:p-2">
            <div className="text-center leading-none text-[#005aa9]">
              <p className="text-lg font-black sm:text-3xl">STI</p>
              <p className="mt-0.5 text-[7px] font-bold tracking-[0.12em] sm:text-[10px]">ALABANG</p>
            </div>
          </div>
          <div className="flex items-center justify-center px-2 py-2 sm:py-3">
            <h3 className="text-center font-sans font-bold text-[clamp(16px,4vw,32px)] tracking-tight text-white">LIBRARY CARD</h3>
          </div>
        </div>

        <div className="grid h-[calc(100%-52px)] grid-rows-[auto_auto_1fr_auto] gap-2 p-2 sm:h-[calc(100%-72px)] sm:gap-3 sm:p-4">
          <div className="flex flex-col justify-between border-b border-foreground pb-1 sm:flex-row sm:items-center">
             <p className="text-[8px] font-bold text-foreground uppercase tracking-wider sm:text-[10px]">Student ID: <span className="font-mono">{studentId}</span></p>
             <p className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider sm:text-[10px]">Card No: {cardNumber}</p>
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

          <div className="flex flex-col gap-1">
            <h4 className="text-center font-sans text-[clamp(14px,3vw,20px)] font-bold text-foreground">Important Reminders</h4>
            <ol className="list-decimal space-y-0.5 pl-5 font-sans text-[9px] leading-tight text-foreground sm:pl-6 sm:text-[11px]">
              <li>This card is non-transferable.</li>
              <li>Present this card every time you borrow books and other library materials.</li>
              <li>Surrender this card at the end of the semester for clearance.</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 items-end gap-4">
            <div className="flex flex-col items-start pb-1">
              <p className="text-[8px] font-bold uppercase tracking-tight text-muted-foreground/60 sm:text-[9px]">Academic Year</p>
              <p className="text-[10px] font-black text-foreground sm:text-[13px]">{academicYear || (() => {
                const now = new Date();
                const currentYear = now.getUTCFullYear();
                const startYear = now.getUTCMonth() >= 5 ? currentYear : currentYear - 1;
                return `${startYear} - ${startYear + 1}`;
              })()}</p>
            </div>

            <div className="flex flex-col items-end pb-1">
              <div className="min-w-[100px] border-b border-foreground text-center sm:min-w-[140px]">
                <p className="font-sans text-[11px] font-bold text-foreground sm:text-sm">{roleLabel || "Librarian"}</p>
              </div>
              <p className="mt-0.5 text-[8px] uppercase tracking-widest text-muted-foreground/60">Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
