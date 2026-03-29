import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 shadow-sm ring-1 ring-slate-200/50">
        <Search size={40} />
        <div className="absolute -inset-1 animate-pulse rounded-3xl bg-slate-50" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Page Not Found
      </h1>

      <p className="mt-4 max-w-md text-slate-500">
        The page you are looking for doesn&apos;t exist or has been moved. Use the navigation below to get back on track.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/" className="w-full sm:w-auto">
          <Button
            size="lg"
            className="h-12 w-full rounded-2xl bg-slate-900 px-8 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <Link href="/protected/catalog" className="w-full sm:w-auto">
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-2xl border-slate-200 px-8 text-sm font-semibold hover:bg-slate-50 sm:w-auto"
          >
            Explore Catalog
          </Button>
        </Link>
      </div>

      <div className="mt-16 text-xs font-medium text-slate-300 uppercase tracking-widest">
        Lumina Library Systems
      </div>
    </div>
  );
}
