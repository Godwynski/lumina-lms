"use client";

import { motion } from "framer-motion";
import { 
  FileText, 
  BookText,
  ScrollText,
  FileBadge,
  User, 
  Calendar, 
  Shield, 
  Eye, 
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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
  } | null;
};

interface AssetCardProps {
  resource: ResourceCard;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
}

function getTypeIcon(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "ebook") return BookText;
  if (normalized === "journal") return ScrollText;
  if (normalized === "report") return FileBadge;
  return FileText;
}

export function ModernAssetCard({ resource, selected, onSelectChange }: AssetCardProps) {
  const modifiedAt = resource.updated_at || resource.created_at;
  const isRecent = new Date(modifiedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const TypeIcon = getTypeIcon(resource.type);

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

        <div className="mb-2 flex items-start justify-between gap-2">
          <Checkbox checked={selected} onCheckedChange={(checked) => onSelectChange(Boolean(checked))} aria-label={`Select ${resource.title}`} className="mt-1" />

          <div className="relative flex h-20 flex-1 items-center justify-center rounded-md border border-border bg-muted/70 text-muted-foreground">
              <TypeIcon size={30} strokeWidth={1.8} />
              {isRecent ? <CircleDot className="absolute right-2 top-2 h-3 w-3 text-emerald-500" /> : null}
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
                <span className="text-[9px] font-semibold uppercase tracking-wider">Last Modified</span>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                {new Date(modifiedAt).toLocaleDateString('en-US')}
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
        </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
