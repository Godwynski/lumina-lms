"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Plus, Trash2, Edit3 } from "lucide-react";
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
      <div className="grid gap-2.5">
        {currentFaqs.map((faq, i) => {
          const added = isNew(faq);
          const modified = isModified(faq);
          return (
            <div key={`curr-${i}`} className={cn(
              "group/faq relative rounded-xl border p-3 transition-all",
              added ? "bg-green-500/[0.03] border-green-500/20 hover:bg-green-500/[0.06]" : 
              modified ? "bg-amber-500/[0.03] border-amber-500/20 hover:bg-amber-500/[0.06]" :
              "bg-muted/5 border-border/30 hover:bg-muted/10"
            )}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-black text-foreground/90 uppercase tracking-wider">Q: {faq.question}</p>
                    {added && (
                      <span className="px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 text-[8px] font-black uppercase tracking-tighter">New</span>
                    )}
                    {modified && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[8px] font-black uppercase tracking-tighter">Modified</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">A: {faq.answer}</p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover/faq:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => startEdit(i)} disabled={disabled}>
                    <Edit3 size={10} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/5" onClick={() => removeFAQ(i)} disabled={disabled}>
                    <Trash2 size={10} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {removedFaqs.length > 0 && (
          <div className="mt-2 space-y-2 border-t border-dashed border-border/40 pt-4">
             <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 px-1 mb-2">Flagged for Removal</p>
             {removedFaqs.map((faq, i) => (
                <div key={`rem-${i}`} className="group/rem relative rounded-xl border border-red-500/10 bg-red-500/[0.02] p-3 transition-all opacity-60 hover:opacity-100 grayscale hover:grayscale-0">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-red-700/60 uppercase tracking-wider line-through">Q: {faq.question}</p>
                        <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 text-[8px] font-black uppercase tracking-tighter">Deleted</span>
                      </div>
                      <p className="text-[10px] text-red-600/50 leading-relaxed line-through italic">A: {faq.answer}</p>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover/rem:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md text-primary/70 hover:text-primary hover:bg-primary/5" onClick={() => restoreFAQ(faq)} disabled={disabled}>
                        <Plus size={10} />
                      </Button>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 space-y-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-primary/60 ml-1 tracking-[0.1em]">Entry Question</Label>
            <Input
              placeholder="How do I..."
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              disabled={disabled}
              className="h-10 rounded-xl border-border/30 bg-background text-[11px] font-bold px-4 shadow-sm focus:ring-1 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-primary/60 ml-1 tracking-[0.1em]">Detailed Answer</Label>
            <Textarea
              placeholder="You can..."
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              disabled={disabled}
              className="min-h-[80px] rounded-xl border-border/30 bg-background text-[11px] font-medium p-4 resize-none shadow-sm focus:ring-1 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={addOrUpdateFAQ}
            disabled={disabled || !newQ.trim() || !newA.trim()}
            className="flex-1 h-10 rounded-xl gap-2.5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 active:scale-95 transition-all"
          >
            {editingIndex !== null ? <ShieldCheck size={14} /> : <Plus size={14} />}
            {editingIndex !== null ? "Apply Update" : "Add to List"}
          </Button>
          {editingIndex !== null && (
            <Button variant="outline" className="h-10 rounded-xl px-4 border-border/60" onClick={() => {setEditingIndex(null); setNewQ(""); setNewA("");}}>
              <Trash2 size={14} className="text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
