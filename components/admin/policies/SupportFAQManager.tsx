"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SupportFAQManager({ 
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
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const currentFaqs = useMemo(() => {
    try {
      return value ? (JSON.parse(value) as { question: string; answer: string }[]) : [];
    } catch { return []; }
  }, [value]);

  const initialFaqs = useMemo(() => {
    try {
      return initialValue ? (JSON.parse(initialValue) as { question: string; answer: string }[]) : [];
    } catch { return []; }
  }, [initialValue]);

  const removedFaqs = useMemo(() => {
    return initialFaqs.filter(init => !currentFaqs.some(curr => curr.question === init.question));
  }, [currentFaqs, initialFaqs]);

  const addOrUpdateFAQ = () => {
    if (!newQ.trim() || !newA.trim()) return;
    
    let updated;
    if (editingIndex !== null) {
      updated = [...currentFaqs];
      updated[editingIndex] = { question: newQ.trim(), answer: newA.trim() };
      setEditingIndex(null);
    } else {
      updated = [...currentFaqs, { question: newQ.trim(), answer: newA.trim() }];
    }
    
    onChange(JSON.stringify(updated));
    setNewQ("");
    setNewA("");
  };

  const removeFAQ = (index: number) => {
    const updated = currentFaqs.filter((_, i) => i !== index);
    onChange(JSON.stringify(updated));
  };

  const restoreFAQ = (faq: { question: string; answer: string }) => {
    const updated = [...currentFaqs, faq];
    onChange(JSON.stringify(updated));
  };

  const startEdit = (index: number) => {
    setNewQ(currentFaqs[index].question);
    setNewA(currentFaqs[index].answer);
    setEditingIndex(index);
  };

  const isNew = (faq: { question: string; answer: string }) => {
    return !initialFaqs.some(init => init.question === faq.question);
  };

  const isModified = (faq: { question: string; answer: string }) => {
    const initial = initialFaqs.find(init => init.question === faq.question);
    return initial && initial.answer !== faq.answer;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {currentFaqs.map((faq, i) => {
          const added = isNew(faq);
          const modified = isModified(faq);
          return (
            <div key={`curr-${i}`} className={cn(
              "group/faq relative rounded-xl border p-4 transition-all",
              added ? "bg-primary/[0.03] border-primary/20" : 
              modified ? "bg-amber-50/50 border-amber-200/50" :
              "bg-muted/5 border-border/40 hover:bg-muted/10"
            )}>
              <div className="flex justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground tracking-tight">{faq.question}</p>
                    {added && (
                      <span className="text-[9px] text-primary font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10">New</span>
                    )}
                    {modified && (
                      <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100">Modified</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">{faq.answer}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover/faq:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-background shadow-sm border border-transparent hover:border-border/40" onClick={() => startEdit(i)} disabled={disabled}>
                    <Edit3 size={12} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent" onClick={() => removeFAQ(i)} disabled={disabled}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {removedFaqs.length > 0 && (
          <div className="mt-2 space-y-2 pt-4 border-t border-border/40">
             <p className="text-[10px] font-medium text-muted-foreground/60 px-1 mb-2">Flagged for removal</p>
             {removedFaqs.map((faq, i) => (
                <div key={`rem-${i}`} className="group/rem relative rounded-lg border border-red-100 bg-red-50/30 p-3 opacity-60 hover:opacity-100 transition-all">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium text-red-700/60 line-through">Q: {faq.question}</p>
                        <span className="text-[10px] text-red-600 font-medium px-1.5 py-0.5 rounded bg-red-100/50">Deleted</span>
                      </div>
                      <p className="text-xs text-red-600/50 leading-relaxed line-through italic">A: {faq.answer}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/rem:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-primary hover:bg-primary/5" onClick={() => restoreFAQ(faq)} disabled={disabled}>
                        <Plus size={12} />
                      </Button>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border/40 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40 ml-1">
          {editingIndex !== null ? "Edit FAQ" : "Add New FAQ"}
        </p>
        <div className="space-y-3">
          <Input
            placeholder="Question"
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            disabled={disabled}
            className="h-9 rounded-xl border-border/40 bg-muted/20 text-xs px-3 focus:bg-background transition-all"
          />
          <Textarea
            placeholder="Answer"
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            disabled={disabled}
            className="min-h-[100px] rounded-xl border-border/40 bg-muted/20 text-xs p-3 resize-none focus:bg-background transition-all"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={addOrUpdateFAQ}
            disabled={disabled || !newQ.trim() || !newA.trim()}
            size="sm"
            className="flex-1 h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
          >
            {editingIndex !== null ? "Update" : "Add FAQ"}
          </Button>
          {editingIndex !== null && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-4 rounded-xl border-border/40 text-[10px] font-bold uppercase tracking-widest transition-all" 
              onClick={() => {setEditingIndex(null); setNewQ(""); setNewA("");}}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
