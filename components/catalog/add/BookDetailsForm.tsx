"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BookDetailsFormProps {
  formData: {
    title: string;
    author: string;
    categoryId: string;
    section: string;
    location: string;
    copies: number;
    tags: string;
  };
  onUpdate: (updates: Partial<BookDetailsFormProps["formData"]>) => void;
  categories: Array<{ id: string; name: string }>;
}

export function BookDetailsForm({ formData, onUpdate, categories }: BookDetailsFormProps) {
  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-2 text-left">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Initial Copies</Label>
          <Input
            type="number" 
            min="1"
            max="100"
            value={formData.copies}
            onChange={e => onUpdate({ copies: parseInt(e.target.value) || 0 })}
            placeholder="1"
            className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm font-bold text-foreground transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
          <p className="text-[10px] text-muted-foreground/70 font-medium ml-1">How many physical copies to add now? (Default: 1)</p>
        </div>
      </div>

      <div className="space-y-2 text-left">
        <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">Subject Tags (Comma Separated)</Label>
        <Input
          type="text" 
          value={formData.tags}
          onChange={e => onUpdate({ tags: e.target.value })}
          placeholder="Programming, Best Practices, Engineering"
          className="h-10 w-full rounded-xl border-border/40 bg-muted/20 px-4 text-sm transition-all focus:bg-background focus:ring-2 focus:ring-primary/20 shadow-sm"
        />
      </div>
    </div>
  );
}
