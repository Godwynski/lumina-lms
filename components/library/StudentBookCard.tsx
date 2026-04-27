"use client";

import { m } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { 
  Book as BookIcon, 
  Sparkles, 
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Book } from "@/lib/types";
import { ReserveTitleButton } from "@/components/common/ReserveTitleButton";
import { cn } from "@/lib/utils";

interface StudentBookCardProps {
  book: Book;
  reservedInfo?: {
    status: string;
    queuePosition: number;
  };
  onReserveSuccess?: (queuePosition: number, status: "READY" | "ACTIVE") => void;
}

export function StudentBookCard({ book, reservedInfo, onReserveSuccess }: StudentBookCardProps) {
  const isOutOfStock = book.available_copies === 0;
  const isReady = reservedInfo?.status === "READY";
  
  return (
    <m.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full"
    >
      <Link href={`/student-catalog/${book.id}`} className="block h-full">
        <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:bg-accent/50 hover:border-primary/30 hover:shadow-lg">
          <div className="mb-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2">
                <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                  {book.title}
                </h3>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground/80">by {book.author}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{book.section || "General"}</span>
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
            </div>

            <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted shadow-sm ring-1 ring-border/50 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2">
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
                  <BookIcon size={20} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
            <Badge variant={isOutOfStock ? "destructive" : "secondary"} className="rounded-full px-2.5 py-0 h-5 text-[10px] font-black tracking-tight">
              {book.available_copies} / {book.total_copies}
            </Badge>
            
            <div onClick={(e) => e.stopPropagation()}>
              <ReserveTitleButton
                bookId={book.id}
                isAvailable={book.available_copies > 0}
                hasExistingReservation={!!reservedInfo}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2 rounded-lg"
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
      </Link>
    </m.div>
  );
}
