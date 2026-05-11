"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit3, HelpCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
    setIsModalOpen(false);
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
    setIsModalOpen(true);
  };

  const startAdd = () => {
    setNewQ("");
    setNewA("");
    setEditingIndex(null);
    setIsModalOpen(true);
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
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          Knowledge Base ({currentFaqs.length})
        </p>
        {!disabled && (
          <Button 
            onClick={startAdd}
            variant="outline"
            size="sm"
            className="h-8 rounded-xl gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 text-[10px] font-bold uppercase tracking-widest transition-all"
          >
            <Plus className="h-3 w-3" />
            Add Question
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {currentFaqs.length === 0 && !disabled && (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-border/60 bg-muted/5">
             <HelpCircle className="h-8 w-8 text-muted-foreground/20 mb-3" />
             <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">No FAQs defined</p>
             <Button 
               variant="link" 
               className="text-[10px] h-auto p-0 mt-1" 
               onClick={startAdd}
             >
               Click here to add your first question
             </Button>
          </div>
        )}

        {currentFaqs.map((faq, i) => {
          const added = isNew(faq);
          const modified = isModified(faq);
          return (
            <div key={`curr-${i}`} className={cn(
              "group/faq relative rounded-2xl border p-5 transition-all",
              added ? "bg-primary/[0.03] border-primary/20" : 
              modified ? "bg-amber-50/50 border-amber-200/50" :
              "bg-muted/5 border-border/40 hover:bg-muted/10"
            )}>
              <div className="flex justify-between gap-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground tracking-tight">{faq.question}</p>
                    {added && (
                      <span className="text-[9px] text-primary font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10">New</span>
                    )}
                    {modified && (
                      <span className="text-[9px] text-amber-600 font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-100">Modified</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">{faq.answer}</p>
                </div>
                {!disabled && (
                  <div className="flex gap-1.5 opacity-0 group-hover/faq:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-background shadow-sm border border-transparent hover:border-border/40 transition-all" onClick={() => startEdit(i)}>
                      <Edit3 size={14} className="text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5 hover:border-destructive/10 border border-transparent transition-all" onClick={() => removeFAQ(i)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {removedFaqs.length > 0 && (
          <div className="mt-4 space-y-2 pt-6 border-t border-border/40">
             <div className="flex items-center gap-2 px-1 mb-4">
                <AlertCircle size={12} className="text-muted-foreground/40" />
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Marked for Deletion</p>
             </div>
             {removedFaqs.map((faq, i) => (
                <div key={`rem-${i}`} className="group/rem relative rounded-xl border border-red-100/50 bg-red-50/20 p-4 opacity-60 hover:opacity-100 transition-all">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-bold text-red-700/60 line-through tracking-tight">Q: {faq.question}</p>
                      </div>
                      <p className="text-xs text-red-600/50 leading-relaxed line-through italic font-medium">A: {faq.answer}</p>
                    </div>
                    {!disabled && (
                      <div className="flex gap-1 opacity-0 group-hover/rem:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-primary hover:bg-primary/5" onClick={() => restoreFAQ(faq)}>
                          <Plus size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
             ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <DialogHeader className="p-8 pb-4 bg-muted/5">
            <DialogTitle className="text-xl font-black tracking-tight text-foreground">
              {editingIndex !== null ? "Modify FAQ" : "New Knowledge Item"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              {editingIndex !== null 
                ? "Update the question and answer for this knowledge base item." 
                : "Add a common question and its corresponding answer for the support system."}
            </p>
          </DialogHeader>

          <div className="p-8 pt-4 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/70 ml-1">The Question</Label>
              <Input
                placeholder="e.g., How do I renew a book copy?"
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                disabled={disabled}
                className="h-12 rounded-2xl border-border/40 bg-muted/20 text-sm px-4 focus:ring-2 focus:ring-primary/10 transition-all font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/70 ml-1">Detailed Answer</Label>
              <Textarea
                placeholder="Write the clear, step-by-step resolution here..."
                value={newA}
                onChange={(e) => setNewA(e.target.value)}
                disabled={disabled}
                className="min-h-[160px] rounded-2xl border-border/40 bg-muted/20 text-sm p-4 resize-none focus:ring-2 focus:ring-primary/10 transition-all leading-relaxed font-medium"
              />
            </div>
          </div>

          <DialogFooter className="p-8 pt-0 flex gap-3">
             <Button 
                variant="ghost" 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 h-12 rounded-2xl text-[10px] font-bold uppercase tracking-widest"
              >
                Cancel
              </Button>
              <Button
                onClick={addOrUpdateFAQ}
                disabled={disabled || !newQ.trim() || !newA.trim()}
                className="flex-[2] h-12 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20"
              >
                {editingIndex !== null ? "Apply Changes" : "Create Item"}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
