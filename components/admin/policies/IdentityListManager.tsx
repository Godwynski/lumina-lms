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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {currentItems.map((item, i) => {
          const isAdded = !initialItems.includes(item);
          return (
            <Badge 
              key={`${item}-${i}`} 
              variant="secondary" 
              className={cn(
                "group/badge h-8 pl-3 pr-1 py-0 rounded-xl text-xs font-semibold transition-all border border-transparent shadow-sm",
                isAdded 
                  ? "bg-primary/10 text-primary border-primary/20" 
                  : "bg-muted/40 text-foreground/80 hover:bg-muted/60"
              )}
            >
              {item}
              <button
                onClick={() => removeItem(item)}
                disabled={disabled}
                className="ml-2 h-6 w-6 rounded-lg flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-all disabled:opacity-50"
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
            className="h-8 pl-3 pr-1 py-0 rounded-xl text-xs font-semibold bg-red-50/30 text-red-400 border-red-100/50 line-through transition-all opacity-60 hover:opacity-100"
          >
            {item}
            <button
              onClick={() => restoreItem(item)}
              disabled={disabled}
              className="ml-2 h-6 w-6 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all text-red-500"
            >
              <Plus size={12} />
            </button>
          </Badge>
        ))}

        {currentItems.length === 0 && removedItems.length === 0 && (
          <p className="text-xs text-muted-foreground/50 italic py-1">No items configured.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          disabled={disabled}
          className="h-9 rounded-lg border-border/40 bg-muted/20 text-xs focus:bg-background transition-all px-3"
        />
        <Button
          type="button"
          onClick={addItem}
          disabled={disabled || !newItem.trim()}
          size="sm"
          className="h-9 px-3 rounded-lg active:scale-95 transition-all"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
