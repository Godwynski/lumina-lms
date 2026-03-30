"use client";

import { motion } from "framer-motion";
import { 
  FileText, 
  BookText,
  ScrollText,
  FileBadge,
  User, 
  Calendar, 
  Eye, 
  CircleDot,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ResourceCard = {
  id: string;
  title: string;
  author: string;
  type: string;
  access_level: string;
  created_at: string;
  updated_at?: string | null;
  published_year?: number | null;
  categories?: {
    name?: string | null;
  }[] | null;
};

interface AssetCardProps {
  resource: ResourceCard;
}

function getTypeIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "ebook") return BookText;
  if (normalized === "journal") return ScrollText;
  if (normalized === "report") return FileBadge;
  return FileText;
}

export function ModernAssetCard({ resource }: AssetCardProps) {
  const modifiedAt = resource.updated_at || resource.created_at;
  const isRecent = new Date(modifiedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const TypeIcon = getTypeIcon(resource.type);

  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group h-full"
    >
      <Card className="h-full overflow-hidden border-border bg-card shadow-sm transition-all hover:border-primary/20 hover:shadow-md dark:bg-card/40">
        <CardContent className="flex h-full flex-col p-4">
          
          {/* Header Visual Area - Taller and more document-like */}
          <div className="relative mb-5 flex h-48 items-center justify-center rounded-lg border border-border/50 bg-gradient-to-br from-muted/30 to-muted/80 p-0 text-muted-foreground transition-colors group-hover:from-muted/50 group-hover:to-muted">
            <div className="flex flex-col items-center gap-3">
              <TypeIcon size={40} strokeWidth={1.5} className="text-foreground/40" />
              <div className="flex items-center gap-1.5 opacity-60">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{resource.type}</span>
              </div>
            </div>

            {/* Float Badge */}
            {isRecent && (
              <div className="absolute top-3 left-3 flex h-6 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-tight text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
                <CircleDot size={10} className="animate-pulse" />
                RECENT
              </div>
            )}

            <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
              <Badge variant="secondary" className="bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                {resource.access_level}
              </Badge>
            </div>
          </div>

          {/* Abstract Metadata Section */}
          <div className="flex-1 space-y-4">
             <div className="space-y-1.5">
               <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                 {resource.categories?.[0]?.name || "ARCHIVE"}
               </div>
               <h3 className="line-clamp-2 text-sm font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
                 {resource.title}
               </h3>
             </div>

             <div className="flex flex-col gap-2.5 border-t border-border/40 pt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                   <User size={13} className="text-primary/70" />
                   <p className="truncate text-xs font-semibold">{resource.author}</p>
                </div>
                
                <div className="flex items-center gap-4 text-muted-foreground">
                   <div className="flex items-center gap-1.5">
                     <Calendar size={13} strokeWidth={2} className="text-muted-foreground/50" />
                     <p className="text-[11px] font-medium tracking-tight">
                       {resource.published_year || new Date(modifiedAt).getFullYear()}
                     </p>
                   </div>
                   <div className="flex items-center gap-1.5">
                     <Clock size={13} strokeWidth={2} className="text-muted-foreground/50" />
                     <p className="text-[11px] font-medium tracking-tight">
                       {new Date(modifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                     </p>
                   </div>
                </div>
             </div>
          </div>

          <Link href={`/protected/resources?view=${resource.id}`} className="mt-6">
            <Button className="h-9 w-full gap-2 rounded-lg bg-primary font-bold tracking-tight text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-primary/20 active:scale-95">
              <Eye size={15} />
              Study Full Doc
            </Button>
          </Link>

        </CardContent>
      </Card>
    </motion.div>
  );
}
