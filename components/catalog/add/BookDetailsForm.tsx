"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookText, Hash, MapPin, Layers, Tag, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookDetailsFormProps {
  formData: {
    title: string;
    author: string;
    categoryId: string;
    section: string;
    location: string;
    copies: number;
    tags: string;
    dewey_decimal: string;
    isbn: string;
  };
  onUpdate: (updates: Partial<BookDetailsFormProps["formData"]>) => void;
  categories: Array<{ id: string; name: string }>;
}

function SectionHeader({ icon: Icon, title }: { icon: any, title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border/10 mb-4">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={14} />
      </div>
      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/70">{title}</h3>
    </div>
  );
}

export function BookDetailsForm({ formData, onUpdate, categories }: BookDetailsFormProps) {
  return (
    <div className="space-y-10">
      {/* 1. Basic Information */}
      <section className="space-y-4">
        <SectionHeader icon={BookText} title="Basic Information" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Book Title *</Label>
            <Input
              type="text" 
              required
              value={formData.title}
              onChange={e => onUpdate({ title: e.target.value })}
              placeholder="e.g. Clean Code"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Author *</Label>
            <Input
              type="text" 
              required
              value={formData.author}
              onChange={e => onUpdate({ author: e.target.value })}
              placeholder="e.g. Robert C. Martin"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* 2. Cataloging & Classification */}
      <section className="space-y-4">
        <SectionHeader icon={Layers} title="Cataloging & Classification" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Category</Label>
            <Select value={formData.categoryId || 'none'} onValueChange={(value) => onUpdate({ categoryId: value === 'none' ? '' : value })}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm">
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Dewey Decimal (DDC)</Label>
            <Input
              type="text" 
              value={formData.dewey_decimal}
              onChange={e => onUpdate({ dewey_decimal: e.target.value })}
              placeholder="e.g. 621.389"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">ISBN Reference</Label>
            <Input
              type="text" 
              value={formData.isbn}
              onChange={e => onUpdate({ isbn: e.target.value })}
              placeholder="9780132350884"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-2 text-left pt-2">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Subject Tags (Comma Separated)</Label>
          <div className="relative group">
            <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input
              type="text" 
              value={formData.tags}
              onChange={e => onUpdate({ tags: e.target.value })}
              placeholder="Programming, Best Practices, Engineering"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 pl-10 pr-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* 3. Inventory & Placement */}
      <section className="space-y-4">
        <SectionHeader icon={MapPin} title="Inventory & Placement" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Physical Section</Label>
            <Input
              type="text" 
              value={formData.section}
              onChange={e => onUpdate({ section: e.target.value })}
              placeholder="e.g. CS Reference"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>
          
          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Exact Location</Label>
            <Input
              type="text" 
              value={formData.location}
              onChange={e => onUpdate({ location: e.target.value })}
              placeholder="e.g. Shelf A-5"
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          <div className="space-y-2 text-left">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80 flex items-center gap-1.5">
              Initial Copies
              <PlusCircle size={10} className="text-primary" />
            </Label>
            <Input
              type="number" 
              min="1"
              max="100"
              value={formData.copies}
              onChange={e => onUpdate({ copies: parseInt(e.target.value) || 0 })}
              className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm font-bold text-foreground transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
