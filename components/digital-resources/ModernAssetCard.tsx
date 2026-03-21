"use client";

import { motion } from "framer-motion";
import { 
  FileText, 
  User, 
  Calendar, 
  Shield, 
  Eye, 
  Download,
  CircleDot,
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
  published_year?: number | null;
  categories?: {
    name?: string | null;
  } | null;
};

interface AssetCardProps {
  resource: ResourceCard;
}

export function ModernAssetCard({ resource }: AssetCardProps) {
  const isRecent = new Date(resource.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Card className="h-full border-border bg-card shadow-sm transition-colors hover:bg-muted">
        <CardContent className="flex h-full flex-col p-3">
        
        <div className="mb-2 flex items-start justify-between">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <FileText size={15} />
              {isRecent ? <CircleDot className="absolute -right-1 -top-1 h-3 w-3 text-emerald-500" /> : null}
            </div>

          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="border-border bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {resource.type}
            </Badge>
            {resource.categories?.name && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-tight text-muted-foreground">
                {resource.categories.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-tight text-foreground">
            {resource.title}
          </h3>
          
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
              <User size={12} className="text-muted-foreground" />
            </div>
            <p className="truncate text-xs font-medium text-muted-foreground">{resource.author}</p>
          </div>

          <div className="mb-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-muted p-2">
              <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground">
                <Calendar size={11} />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Released</span>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                {resource.published_year || new Date(resource.created_at).getFullYear()}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted p-2">
              <div className="mb-0.5 flex items-center gap-1.5 text-emerald-600">
                <Shield size={11} />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Security</span>
              </div>
              <p className="text-xs font-semibold text-emerald-600">{resource.access_level}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-border pt-2.5">
          <Link href={`/protected/resources?view=${resource.id}`} className="flex-1">
            <Button className="flex h-8 w-full items-center gap-1.5 rounded-md bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95">
              <Eye size={14} />
              Open
            </Button>
          </Link>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-md border-border text-muted-foreground hover:bg-muted">
             <Download size={14} />
          </Button>
        </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
