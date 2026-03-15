"use client";

import { ShieldAlert, Globe, ArrowLeft, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OfflineLandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative">
           <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
             <WifiOff size={48} />
           </div>
           <div className="absolute top-0 right-1/4 translate-x-1/2 bg-red-500 text-white p-2 rounded-full border-4 border-white shadow-lg">
             <ShieldAlert size={20} />
           </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight leading-tight">
            Internet Connection Required
          </h1>
          <p className="text-zinc-500 text-lg">
            This feature is currently unavailable during network blackouts. Your current session is limited to <strong>Digital Resources</strong> only.
          </p>
        </div>

        <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-4">
           <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                 <Globe size={20} />
              </div>
              <p className="text-sm font-medium text-zinc-700">Why am I seeing this?</p>
           </div>
           <p className="text-xs text-zinc-500 leading-relaxed text-left">
             Our Hybrid Offline-First system automatically enables emergency access to e-books and journals when the school's internet connection or SSO provider is unreachable. Other services remain offline to protect data integrity.
           </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/protected/resources" className="w-full">
            <Button className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all">
              Return to Digital Resources
            </Button>
          </Link>
          <Link href="/offline-access" className="w-full">
            <Button variant="ghost" className="w-full h-12 text-zinc-500 hover:text-zinc-900 rounded-2xl">
              <ArrowLeft className="mr-2" size={18} />
              Switch PIN / Try Re-logging
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
