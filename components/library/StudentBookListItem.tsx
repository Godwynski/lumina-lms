"use client";

import { m } from "framer-motion";
import { Book as BookIcon, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Book } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { ReserveTitleButton } from "@/components/common/ReserveTitleButton";
import { cn } from "@/lib/utils";

interface StudentBookListItemProps {
  book: Book;
  reservedInfo?: {
    status: string;
    queuePosition: number;
  };
  onReserveSuccess?: (queuePosition: number, status: "READY" | "ACTIVE") => void;
}

export function StudentBookListItem({ book, reservedInfo, onReserveSuccess }: StudentBookListItemProps) {
  const isOutOfStock = book.available_copies === 0;
  const isReady = reservedInfo?.status === "READY";
  
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group relative"
    >
      <Link href={`/student-catalog/${book.id}`} className="block">
        <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-2.5 transition-all hover:bg-accent/50 hover:border-primary/30 hover:shadow-md">
          {/* Cover Image */}
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm ring-1 ring-border/50 transition-transform group-hover:scale-105">
            {book.cover_url ? (
              <Image 
                src={book.cover_url} 
                alt={book.title} 
                fill 
                className="object-cover" 
                sizes="80px"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/40">
                <BookIcon size={24} />
              </div>
            )}
          </div>

          {/* Info Columns: 2-3 Rows of info */}
          <div className="flex flex-1 min-w-0 flex-col justify-center gap-1">
            {/* Row 1: Title & Reserve Badge */}
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                {book.title}
              </h3>
              {reservedInfo && (
                <Badge
                  variant={isReady ? "default" : "outline"}
                  className={cn(
                    "shrink-0 text-[9px] px-1.5 py-0 h-[18px] gap-1 font-black",
                    isReady
                      ? "bg-emerald-500 hover:bg-emerald-500 text-white border-transparent"
                      : "border-primary/30 text-primary bg-primary/5"
                  )}
                >
                  {isReady ? <Sparkles className="h-2.5 w-2.5" /> : <Ticket className="h-2.5 w-2.5" />}
                  {isReady ? "Ready" : `#${reservedInfo.queuePosition}`}
                </Badge>
              )}
            </div>

            {/* Row 2: Author & Section */}
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/80">
              <span className="truncate">by {book.author}</span>
              <span className="h-3 w-[1px] bg-border/60" />
              <span className="truncate uppercase tracking-wider text-[10px] opacity-70">{book.section || "General"}</span>
            </div>

            {/* Row 3: ISBN & Availability Ratio */}
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold font-mono text-muted-foreground/40">{book.isbn || "INTERNAL-STOCK"}</span>
               <div className="flex items-center gap-1.5">
                  <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="h-[18px] rounded-full px-2 py-0 text-[10px] font-black tracking-tight">
                    {book.available_copies} / {book.total_copies}
                  </Badge>
                  <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest hidden xs:inline">Available</span>
               </div>
            </div>
          </div>

          {/* Action Area: Prevent click propagation to Link */}
          <div className="flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
            <ReserveTitleButton
              bookId={book.id}
              isAvailable={book.available_copies > 0}
              hasExistingReservation={!!reservedInfo}
              variant="default"
              size="sm"
              className="h-8 min-w-[90px] text-[11px] font-bold shadow-sm"
              onReserveSuccess={onReserveSuccess}
            />
          </div>
        </div>
      </Link>
    </m.div>
  );
}
