"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Plus, Trash2, Edit3 } from "lucide-react";

export function SupportFAQManager({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  disabled: boolean; 
}) {
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const faqs = useMemo(() => {
    try {
      if (value.startsWith("[") && value.endsWith("]")) {
        return JSON.parse(value) as { question: string; answer: string }[];
      }
      return [];
    } catch {
      return [];
    }
  }, [value]);

  const addOrUpdateFAQ = () => {
    if (!newQ.trim() || !newA.trim()) return;
    
    let updated;
    if (editingIndex !== null) {
      updated = [...faqs];
      updated[editingIndex] = { question: newQ.trim(), answer: newA.trim() };
      setEditingIndex(null);
    } else {
      updated = [...faqs, { question: newQ.trim(), answer: newA.trim() }];
    }
    
    onChange(JSON.stringify(updated));
    setNewQ("");
    setNewA("");
  };

  const removeFAQ = (index: number) => {
    const updated = faqs.filter((_, i) => i !== index);
    onChange(JSON.stringify(updated));
  };

  const startEdit = (index: number) => {
    setNewQ(faqs[index].question);
    setNewA(faqs[index].answer);
    setEditingIndex(index);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        {faqs.map((faq, i) => (
          <div key={i} className="group/faq relative rounded-xl border border-border/30 bg-muted/5 p-3 transition-all hover:bg-muted/10">
            <div className="flex justify-between gap-3">
               <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-foreground/90 uppercase tracking-wider mb-0.5">Q: {faq.question}</p>
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
        ))}
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 space-y-3">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-[9px] font-bold uppercase text-primary/60 ml-1">Question</Label>
            <Input
              placeholder="Question..."
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              disabled={disabled}
              className="h-8 rounded-lg border-border/30 bg-background text-[10px] font-medium px-3"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9px] font-bold uppercase text-primary/60 ml-1">Answer</Label>
            <Textarea
              placeholder="Answer..."
              value={newA}
              onChange={(e) => setNewA(e.target.value)}
              disabled={disabled}
              className="min-h-[60px] rounded-lg border-border/30 bg-background text-[10px] font-medium p-3 resize-none"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={addOrUpdateFAQ}
          disabled={disabled || !newQ.trim() || !newA.trim()}
          className="w-full h-8 rounded-lg gap-2 text-[9px] font-black uppercase tracking-widest"
        >
          {editingIndex !== null ? <ShieldCheck size={12} /> : <Plus size={12} />}
          {editingIndex !== null ? "Update Entry" : "Add Entry"}
        </Button>
        {editingIndex !== null && (
          <Button variant="ghost" className="w-full h-8 text-[10px] font-bold" onClick={() => {setEditingIndex(null); setNewQ(""); setNewA("");}}>
            Cancel Editing
          </Button>
        )}
      </div>
    </div>
  );
}
