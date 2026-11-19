"use client";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldGroup } from "@/components/common/FieldGroup";
import { cn } from "@/lib/utils";
import { BookText, MapPin, Layers, Tag } from "lucide-react";
import { OptionalCopyAcquisition } from "@/components/catalog/CopyAcquisitionFields";
import type { CopyAcquisition } from "@/lib/copy-acquisition";

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
    description: string;
    published_year: string;
  };
  onUpdate: (updates: Partial<BookDetailsFormProps["formData"]>) => void;
  categories: Array<{ id: string; name: string }>;
  hideIsbnField?: boolean;
  validationAttempted?: boolean;
  acquisition?: CopyAcquisition;
  onAcquisitionChange?: (value: CopyAcquisition) => void;
  acquisitionError?: string | null;
}

const UNIFIED_INPUT_CLASS = "h-10 w-full rounded-lg border-border/60 bg-background px-3 text-sm";

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType, title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border/20 mb-4">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={14} aria-hidden="true" />
      </div>
      <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
  );
}

export function BookDetailsForm({
  formData, onUpdate, categories, hideIsbnField = false, validationAttempted = false,
  acquisition, onAcquisitionChange, acquisitionError,
}: BookDetailsFormProps) {
  return (
    <div className="space-y-8">
      {/* 1. Basic Information */}
      <section className="space-y-4">
        <SectionHeader icon={BookText} title="Basic Information" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldGroup label="Book Title *">
            <Input
              type="text"
              required
              aria-invalid={validationAttempted && !formData.title.trim() ? true : undefined}
              value={formData.title}
              onChange={e => onUpdate({ title: e.target.value })}
              placeholder="e.g. Clean Code"
              className={UNIFIED_INPUT_CLASS}
            />
          </FieldGroup>

          <FieldGroup label="Author *">
            <Input
              type="text"
              required
              aria-invalid={validationAttempted && !formData.author.trim() ? true : undefined}
              value={formData.author}
              onChange={e => onUpdate({ author: e.target.value })}
              placeholder="e.g. Robert C. Martin"
              className={UNIFIED_INPUT_CLASS}
            />
          </FieldGroup>

          <FieldGroup label="Publication Year" className="md:col-span-2">
            <Input
              type="number"
              min="1000"
              max={new Date().getFullYear() + 1}
              value={formData.published_year}
              onChange={event => onUpdate({ published_year: event.target.value })}
              placeholder="When available from the ISBN lookup"
              className={UNIFIED_INPUT_CLASS}
            />
          </FieldGroup>

          <FieldGroup label="Description" className="md:col-span-2">
            <Textarea
              rows={4}
              value={formData.description}
              onChange={event => onUpdate({ description: event.target.value })}
              placeholder="Book summary or description"
              className="w-full rounded-lg border-border/60 bg-background px-3 py-2 text-sm"
            />
          </FieldGroup>
        </div>
      </section>

      {/* 2. Cataloging & Classification */}
      <section className="space-y-4">
        <SectionHeader icon={Layers} title="Cataloging & Classification" />
        <div className={cn("grid grid-cols-1 gap-4", hideIsbnField ? "md:grid-cols-2" : "md:grid-cols-3")}>
          <FieldGroup label="Category">
            <Select value={formData.categoryId || 'none'} onValueChange={(value) => onUpdate({ categoryId: value === 'none' ? '' : value })}>
              <SelectTrigger className={UNIFIED_INPUT_CLASS}>
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>

          <FieldGroup label="Dewey Decimal (DDC)">
            <Input
              type="text"
              value={formData.dewey_decimal}
              onChange={e => onUpdate({ dewey_decimal: e.target.value })}
              placeholder="e.g. 621.389"
              className={UNIFIED_INPUT_CLASS}
            />
          </FieldGroup>

          {!hideIsbnField && (
            <FieldGroup label="ISBN Reference">
              <Input
                type="text"
                value={formData.isbn}
                onChange={e => onUpdate({ isbn: e.target.value.replace(/[^0-9Xx]/g, '').toUpperCase() })}
                placeholder="9780132350884"
                className={UNIFIED_INPUT_CLASS}
              />
            </FieldGroup>
          )}
        </div>

        <FieldGroup label="Subject Tags (Comma Separated)">
          <div className="relative group">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" aria-hidden="true" />
            <Input
              type="text"
              value={formData.tags}
              onChange={e => onUpdate({ tags: e.target.value })}
              placeholder="Programming, Best Practices, Engineering"
              className="h-10 w-full rounded-lg border-border/60 bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </FieldGroup>
      </section>

      {/* 3. Inventory & Placement */}
      <section className="space-y-4">
        <SectionHeader icon={MapPin} title="Inventory & Placement" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FieldGroup label="Physical Section">
            <Input
              type="text"
              value={formData.section}
              onChange={e => onUpdate({ section: e.target.value })}
              placeholder="e.g. CS Reference"
              className={UNIFIED_INPUT_CLASS}
            />
          </FieldGroup>

          <FieldGroup label="Exact Location">
            <Input
              type="text"
              value={formData.location}
              onChange={e => onUpdate({ location: e.target.value })}
              placeholder="e.g. Shelf A-5"
              className={UNIFIED_INPUT_CLASS}
            />
          </FieldGroup>

          <FieldGroup label="Initial Copies">
            <Input
              type="number"
              min="1"
              max="100"
              value={formData.copies}
              onKeyDown={(e) => {
                if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onChange={e => onUpdate({ copies: parseInt(e.target.value) || 0 })}
              className="h-10 w-full rounded-lg border-border/60 bg-background px-3 text-sm font-semibold text-foreground"
            />
          </FieldGroup>
        </div>
        {acquisition && onAcquisitionChange && (
          <div className="border-t border-border/40 pt-2">
            <OptionalCopyAcquisition value={acquisition} onChange={onAcquisitionChange} />
            {acquisitionError && <p role="alert" className="text-sm text-destructive">{acquisitionError}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
