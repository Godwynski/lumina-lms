"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleNavigate = (id: string) => {
    setLoading(id);
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground shadow-sm ring-1 ring-border/50">
        <Search size={40} />
        <div className="absolute -inset-1 animate-pulse rounded-3xl bg-muted/50" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Page Not Found
      </h1>

      <p className="mt-4 max-w-md text-muted-foreground">
        The page you are looking for doesn&apos;t exist or has been moved. Use the navigation below to get back on track.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/" className="w-full sm:w-auto" onClick={() => handleNavigate('home')}>
          <Button
            size="lg"
            disabled={!!loading}
            className="h-12 w-full rounded-2xl bg-primary text-primary-foreground px-8 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            {loading === 'home' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeft className="mr-2 h-4 w-4" />
            )}
            Back to Home
          </Button>
        </Link>
        <Link href="/catalog" className="w-full sm:w-auto" onClick={() => handleNavigate('catalog')}>
          <Button
            variant="outline"
            size="lg"
            disabled={!!loading}
            className="h-12 w-full rounded-2xl border-input px-8 text-sm font-semibold hover:bg-muted sm:w-auto"
          >
            {loading === 'catalog' && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Explore Catalog
          </Button>
        </Link>
      </div>

      <div className="mt-16 text-xs font-medium text-muted-foreground uppercase tracking-widest">
        Lumina Library Systems
      </div>
    </div>
  );
}
