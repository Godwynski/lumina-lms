"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
        return JSON.parse(value) as string[];
      }
      return value.split(",").map(i => i.trim()).filter(Boolean);
    } catch {
      return value.split(",").map(i => i.trim()).filter(Boolean);
    }
  }, [value]);

  const initialItems = useMemo(() => {
    try {
      if (initialValue.startsWith("[") && initialValue.endsWith("]")) {
        return JSON.parse(initialValue) as string[];
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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-2xl bg-muted/5 border border-border/20">
        {currentItems.map((item) => {
          const isAdded = !initialItems.includes(item);
          return (
            <Badge 
              key={item} 
              variant="secondary" 
              className={cn(
                "group/badge h-8 pl-3 pr-1 py-0 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                isAdded 
                  ? "bg-green-500/10 text-green-600 border-green-500/20 shadow-sm" 
                  : "bg-primary/10 text-primary border-primary/20 shadow-none"
              )}
            >
              {item}
              <button
                onClick={() => removeItem(item)}
                disabled={disabled}
                className="ml-2 h-6 w-6 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </Badge>
          );
        })}
        
        {removedItems.map((item) => (
          <Badge 
            key={`rem-${item}`} 
            variant="outline" 
            className="h-8 pl-3 pr-1 py-0 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-red-500/[0.03] text-red-600/40 border-red-500/10 line-through decoration-red-500/30 transition-all hover:opacity-100 opacity-60"
          >
            {item}
            <button
              onClick={() => restoreItem(item)}
              disabled={disabled}
              className="ml-2 h-6 w-6 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
            >
              <Plus size={12} />
            </button>
          </Badge>
        ))}

        {currentItems.length === 0 && removedItems.length === 0 && (
          <p className="text-[10px] text-muted-foreground/50 italic px-2 py-1">No items configured.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New entry..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          disabled={disabled}
          className="h-10 rounded-xl border-border/30 bg-muted/10 text-[11px] font-bold focus:bg-background transition-all px-4 shadow-sm"
        />
        <Button
          type="button"
          onClick={addItem}
          disabled={disabled || !newItem.trim()}
          size="icon"
          className="h-10 w-10 rounded-xl shadow-lg shadow-primary/10 active:scale-95 transition-all"
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
