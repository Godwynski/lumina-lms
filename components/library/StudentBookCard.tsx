"use client";

import { m } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { 
  Sparkles, 
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Book } from "@/lib/types";
import { ReserveTitleButton } from "@/components/common/ReserveTitleButton";
import { cn } from "@/lib/utils";
import { BookDetailModal } from "@/components/catalog/BookDetailModal";

interface StudentBookCardProps {
  book: Book;
  priority?: boolean;
  reservedInfo?: {
    status: string;
    queuePosition: number;
    holdExpiresAt?: string | null;
  };
  onReserveSuccess?: (queuePosition: number, status: "READY" | "ACTIVE", holdExpiresAt?: string | null) => void;
  onCancelSuccess?: () => void;
}

export function StudentBookCard({ book, priority, reservedInfo, onReserveSuccess, onCancelSuccess }: StudentBookCardProps) {
  const isOutOfStock = book.available_copies === 0;
  const isReady = reservedInfo?.status === "READY";
  const [modalOpen, setModalOpen] = useState(false);
  // Derived from the prop so an updated cover shows up; only a failed URL falls back.
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const imgSrc = book.cover_url && book.cover_url !== failedCover ? book.cover_url : "/images/default-book-cover.png";
  
  return (
    <m.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full"
    >
      <div className="h-full">
        <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border/40 bg-card p-3 shadow-sm transition-all hover:bg-accent/50 hover:border-primary/20 hover:shadow-lg">
          <div className="mb-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2">
                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                  <button type="button" className="cursor-pointer text-left after:absolute after:inset-0 after:z-10 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary" aria-label={`View details for ${book.title}`} onClick={() => setModalOpen(true)}>
                    {book.title}
                  </button>
                </h3>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">by {book.author}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                 <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{book.section || "General"}</span>
                 {reservedInfo && (
                    <Badge
                      variant={isReady ? "default" : "outline"}
                      className={cn(
                        "shrink-0 text-[11px] px-1.5 py-0 h-[18px] gap-1 font-black",
                        isReady
                          ? "bg-emerald-700 hover:bg-emerald-700 text-white border-transparent"
                          : "border-primary/30 text-primary bg-primary/5"
                      )}
                    >
                      {isReady ? <Sparkles className="h-2.5 w-2.5" /> : <Ticket className="h-2.5 w-2.5" />}
                      {isReady ? "Ready" : `#${reservedInfo.queuePosition}`}
                    </Badge>
                 )}
              </div>
            </div>

            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-muted/20 shadow-sm transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2">
              <Image 
                src={imgSrc} 
                alt=""
                fill 
                className="object-cover" 
                sizes="80px"
                priority={priority}
                unoptimized
                onError={() => setFailedCover(book.cover_url ?? null)}
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/30">
            <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0 h-5 text-[11px] font-black tracking-tight">
              {book.available_copies}<span className="sr-only"> available</span> / {book.total_copies}<span className="sr-only"> total copies</span>
            </Badge>
            
            <div className="relative z-20">
              <ReserveTitleButton
                bookId={book.id}
                isAvailable={book.available_copies > 0}
                hasExistingReservation={!!reservedInfo}
                isReady={reservedInfo?.status === "READY"}
                queuePosition={reservedInfo?.queuePosition}
                holdExpiresAt={reservedInfo?.holdExpiresAt}
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2 rounded-lg"
                onReserveSuccess={onReserveSuccess}
              />
            </div>
          </div>

          {/* Tactile progress bar at the bottom */}
          <div className="absolute bottom-0 left-0 h-1 w-full bg-muted/20">
            <m.div 
              initial={{ width: 0 }}
              animate={{ width: `${(book.available_copies / (book.total_copies || 1)) * 100}%` }}
              className={cn(
                "h-full transition-colors duration-500",
                isOutOfStock ? "bg-destructive" : "bg-primary group-hover:bg-primary-foreground"
              )}
            />
          </div>
        </div>
      </div>

      <BookDetailModal
        bookId={book.id}
        open={modalOpen}
        onOpenChange={setModalOpen}
        variant="student"
        initialData={book}
        onCancelSuccess={onCancelSuccess}
      />
    </m.div>
  );
}
