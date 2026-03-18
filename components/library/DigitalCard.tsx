"use client";

import { GraduationCap, Calendar, ShieldCheck, MapPin } from "lucide-react";
import { MagicCard } from "@/components/magicui/magic-card"; // Adjust paths based on your setup
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
}: DigitalCardProps) {
  // Status Color Mapping
  const statusConfig = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    suspended: "bg-red-500/10 text-red-500 border-red-500/20",
    expired: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  };

  const formattedExpiry = new Date(expiryDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-center justify-center p-4 w-full">
      <MagicCard 
        id="library-card-element"
        className="group relative flex flex-col aspect-[1.6/1] w-full max-w-[500px] overflow-hidden border bg-white dark:bg-zinc-950 shadow-2xl transition-all"
        gradientColor="#E2E8F0"
      >
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-400" />

        {/* Card Header */}
        <div className="flex justify-between items-start p-6 pb-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter text-blue-700 italic">
              STI <span className="text-zinc-400 font-light not-italic text-sm ml-2">LMS</span>
            </h2>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusConfig[status]}`}>
              <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", 
                status === 'active' ? 'bg-emerald-500' : 'bg-current'
              )} />
              {status}
            </div>
          </div>
          
          <div className="relative group/avatar">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full blur opacity-25 group-hover/avatar:opacity-50 transition" />
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-white shadow-lg bg-zinc-100">
              {avatarUrl ? (
                <Image 
                  src={avatarUrl} 
                  alt={fullName} 
                  width={64} 
                  height={64} 
                  className="h-full w-full object-cover" 
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-zinc-400">
                  {fullName?.charAt(0)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-1 px-6 py-2">
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">Student Name</p>
              <p className="text-lg font-bold leading-tight text-zinc-800 dark:text-zinc-100">{fullName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-[10px] text-zinc-400">ID Number</p>
                  <p className="text-xs font-mono font-semibold">{studentId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-[10px] text-zinc-400">Department</p>
                  <p className="text-xs font-semibold truncate max-w-[100px]">{department}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center pl-4 border-l border-zinc-100 dark:border-zinc-800">
            <div className="p-1 bg-white rounded-lg shadow-inner ring-1 ring-zinc-200 overflow-hidden">
              {qrUrl ? (
                <Image
                  src={qrUrl}
                  alt={`QR code for ${cardNumber}`}
                  width={80}
                  height={80}
                  className="h-20 w-20"
                  unoptimized
                />
              ) : (
                <div className="h-20 w-20 bg-zinc-50 animate-pulse flex items-center justify-center">
                   <div className="h-10 w-10 border-2 border-zinc-200 border-t-zinc-400 rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="mt-1 text-[9px] font-mono text-zinc-400">{cardNumber}</p>
          </div>
        </div>

        {/* Card Footer */}
        <div className="mt-auto bg-zinc-50 dark:bg-zinc-900/50 px-6 py-3 flex justify-between items-center border-t">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-[10px] text-zinc-500">Expires: <span className="font-bold">{formattedExpiry}</span></span>
          </div>
          <ShieldCheck className="h-4 w-4 text-zinc-300" />
        </div>
      </MagicCard>
    </div>
  );
}
