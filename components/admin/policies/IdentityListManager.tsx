"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

export function IdentityListManager({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  disabled: boolean; 
}) {
  const [newItem, setNewItem] = useState("");
  
  const items = useMemo(() => {
    try {
      if (value.startsWith("[") && value.endsWith("]")) {
        return JSON.parse(value) as string[];
      }
      return value.split(",").map(i => i.trim()).filter(Boolean);
    } catch {
      return value.split(",").map(i => i.trim()).filter(Boolean);
    }
  }, [value]);

  const addItem = () => {
    if (!newItem.trim() || items.includes(newItem.trim())) return;
    const updated = [...items, newItem.trim()];
    onChange(JSON.stringify(updated));
    setNewItem("");
  };

  const removeItem = (item: string) => {
    const updated = items.filter(i => i !== item);
    onChange(JSON.stringify(updated));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge 
            key={item} 
            variant="secondary" 
            className="group/badge h-7 pl-3 pr-1 py-0 rounded-lg bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-wider"
          >
            {item}
            <button
              onClick={() => removeItem(item)}
              disabled={disabled}
              className="ml-2 h-5 w-5 rounded-md flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
        {items.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">No items added yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add new identity option..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          disabled={disabled}
          className="h-10 rounded-xl border-border/40 bg-muted/10 text-[11px] font-medium focus:bg-background transition-all px-4"
        />
        <Button
          type="button"
          onClick={addItem}
          disabled={disabled || !newItem.trim()}
          size="icon"
          className="h-10 w-10 rounded-xl shadow-lg shadow-primary/10"
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
