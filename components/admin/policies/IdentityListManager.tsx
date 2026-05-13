"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ListRestart, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Manages collections of identity-based strings (e.g. Student IDs, Emails).
 * Refined with a high-fidelity, premium administrative aesthetic.
 */
export function IdentityListManager({ 
  value, 
  initialValue,
  onChange, 
  disabled 
}: { 
  value: string; 
  initialValue: string;
  onChange: (val: string) => void; 
  disabled: boolean; 
}) {
  const [newItem, setNewItem] = useState("");
  
  const currentItems = useMemo(() => {
    try {
      if (value.startsWith("[") && value.endsWith("]")) {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(i => typeof i === "string") : [];
      }
      return value.split(",").map(i => i.trim()).filter(Boolean);
    } catch {
      return value.split(",").map(i => i.trim()).filter(Boolean);
    }
  }, [value]);

  const initialItems = useMemo(() => {
    try {
      if (initialValue.startsWith("[") && initialValue.endsWith("]")) {
        const parsed = JSON.parse(initialValue);
        return Array.isArray(parsed) ? parsed.filter(i => typeof i === "string") : [];
      }
      return initialValue.split(",").map(i => i.trim()).filter(Boolean);
    } catch {
      return initialValue.split(",").map(i => i.trim()).filter(Boolean);
    }
  }, [initialValue]);

  const removedItems = useMemo(() => {
    return initialItems.filter(init => !currentItems.includes(init));
  }, [currentItems, initialItems]);

  const addItem = () => {
    if (!newItem.trim() || currentItems.includes(newItem.trim())) return;
    const updated = [...currentItems, newItem.trim()];
    onChange(JSON.stringify(updated));
    setNewItem("");
  };

  const removeItem = (item: string) => {
    const updated = currentItems.filter(i => i !== item);
    onChange(JSON.stringify(updated));
  };

  const restoreItem = (item: string) => {
    const updated = [...currentItems, item];
    onChange(JSON.stringify(updated));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-500">
      <div className="flex flex-wrap gap-2.5 min-h-[44px] p-4 rounded-[1.5rem] bg-muted/[0.02] border border-border/5 shadow-inner">
        {currentItems.map((item, i) => {
          const isAdded = !initialItems.includes(item);
          return (
            <Badge 
              key={`${item}-${i}`} 
              variant="secondary" 
              className={cn(
                "group/badge h-8 pl-3 pr-1 py-0 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border shadow-sm",
                isAdded 
                  ? "bg-primary/10 text-primary border-primary/20" 
                  : "bg-background text-muted-foreground border-border/20 hover:border-border/40"
              )}
            >
              <Hash className="h-2.5 w-2.5 mr-2 opacity-30 group-hover/badge:opacity-60 transition-opacity" />
              {item}
              <button
                onClick={() => removeItem(item)}
                disabled={disabled}
                className="ml-2.5 h-6 w-6 rounded-xl flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </Badge>
          );
        })}
        
        {removedItems.map((item, i) => (
          <Badge 
            key={`rem-${item}-${i}`} 
            variant="outline" 
            className="h-8 pl-3 pr-1 py-0 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-muted/[0.05] text-muted-foreground/50 border-border/20 line-through transition-all opacity-80 hover:opacity-100"
          >
            {item}
            <button
              onClick={() => restoreItem(item)}
              disabled={disabled}
              className="ml-2 h-5 w-5 rounded-md flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground/40"
            >
              <ListRestart size={10} />
            </button>
          </Badge>
        ))}

        {currentItems.length === 0 && removedItems.length === 0 && (
          <div className="flex items-center gap-2 py-1">
            <p className="text-[9px] font-bold text-muted-foreground/20 uppercase tracking-widest">No identifiers found</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 px-1">
        <div className="relative flex-1 group/input">
          <Input
            placeholder="Add identifier..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
            disabled={disabled}
            className="h-10 rounded-lg border-border/10 bg-muted/5 text-[10px] font-bold uppercase tracking-widest focus:ring-0 transition-all px-4 placeholder:text-muted-foreground/20"
          />
        </div>
        <Button
          type="button"
          onClick={addItem}
          disabled={disabled || !newItem.trim()}
          className="h-10 px-6 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all active:scale-[0.98] shrink-0"
        >
          <Plus className="h-3 w-3 mr-2" />
          Add
        </Button>
      </div>
    </div>
  );
}

