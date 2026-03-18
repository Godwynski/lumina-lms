import { WifiOff, BookOpen, CreditCard, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Offline | Lumina LMS",
};

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-lg relative z-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Icon */}
        <div className="relative inline-flex mx-auto">
          <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center text-zinc-600 shadow-xl">
            <WifiOff size={44} />
          </div>
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 border-2 border-zinc-950" />
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
            You&apos;re Offline
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed">
            This page isn&apos;t available offline. However, these features are still cached and accessible:
          </p>
        </div>

        {/* Available offline pages */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            {
              href: "/protected/catalog",
              icon: BookOpen,
              label: "Catalog",
              desc: "Browse recently loaded books",
            },
            {
              href: "/protected/my-card",
              icon: CreditCard,
              label: "Library Card",
              desc: "Show your digital card for scanning",
            },
            {
              href: "/protected/history",
              icon: History,
              label: "My History",
              desc: "View currently borrowed books",
            },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-indigo-500/50 hover:bg-zinc-800/50 transition-all"
            >
              <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">{label}</p>
                <p className="text-xs text-zinc-500 leading-snug">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/">
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl"
          >
            Go to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
