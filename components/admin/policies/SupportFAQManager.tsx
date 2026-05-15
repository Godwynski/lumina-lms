"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit3, HelpCircle, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/**
 * Manages the FAQ / Knowledge Base items for policy support.
 * Designed with a high-fidelity, premium administrative aesthetic.
 */
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

  const MAX_Q_LENGTH = 120;
  const MAX_A_LENGTH = 600;

  const addOrUpdateFAQ = () => {
    if (!newQ.trim() || !newA.trim()) return;
    if (newQ.length > MAX_Q_LENGTH || newA.length > MAX_A_LENGTH) return;
    
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 flex items-center gap-2">
            Knowledge Base
          </p>
          <p className="text-[9px] font-medium text-muted-foreground/30 uppercase tracking-widest">
            {currentFaqs.length} entries registered
          </p>
        </div>
        {!disabled && (
          <Button 
            onClick={startAdd}
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl gap-2 text-primary hover:bg-primary/5 text-[10px] font-bold uppercase tracking-widest transition-all"
          >
            <Plus className="h-3 w-3" />
            Add Entry
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {currentFaqs.length === 0 && !disabled && (
          <div className="flex flex-col items-center justify-center py-12 rounded-[2rem] border border-dashed border-border/20 bg-muted/[0.01]">
             <div className="h-12 w-12 rounded-2xl bg-muted/5 flex items-center justify-center mb-3">
               <HelpCircle className="h-6 w-6 text-muted-foreground/10" />
             </div>
             <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">No entries found</p>
          </div>
        )}

        <div className="grid gap-3">
          {currentFaqs.map((faq, i) => {
            const added = isNew(faq);
            const modified = isModified(faq);
            return (
                <div key={`curr-${i}`} className={cn(
                  "group/faq relative rounded-[2rem] border p-6 transition-all duration-300",
                  added ? "bg-primary/[0.02] border-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.05)]" : 
                  modified ? "bg-primary/[0.01] border-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.02)]" :
                  "bg-muted/[0.02] border-border/40 hover:bg-muted/[0.05] hover:border-border/60 hover:shadow-xl hover:shadow-muted/5"
                )}>
                  <div className="flex justify-between gap-8">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                          added || modified ? "bg-primary/10 text-primary" :
                          "bg-muted/20 text-muted-foreground/60"
                        )}>
                          <MessageSquare className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-bold text-foreground tracking-tight line-clamp-1">{faq.question}</p>
                        {added && (
                          <span className="text-[8px] text-primary font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">New</span>
                        )}
                        {modified && (
                          <span className="text-[8px] text-primary/80 font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">Edited</span>
                        )}
                      </div>
                    <div className="flex gap-4 items-start pl-11">
                      <ArrowRight className="h-3 w-3 text-muted-foreground/20 mt-1 shrink-0" />
                      <p className="text-xs text-muted-foreground/60 leading-relaxed font-medium line-clamp-2">{faq.answer}</p>
                    </div>
                  </div>
                  {!disabled && (
                    <div className="flex gap-2 opacity-0 group-hover/faq:opacity-100 transition-all duration-300 translate-x-2 group-hover/faq:translate-x-0">
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-background shadow-inner border border-transparent hover:border-border/10 transition-all" onClick={() => startEdit(i)}>
                        <Edit3 size={15} className="text-muted-foreground/60 group-hover/faq:text-primary transition-colors" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-muted-foreground/20 hover:text-rose-500/60 hover:bg-rose-500/[0.02] transition-all" onClick={() => removeFAQ(i)}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {removedFaqs.length > 0 && (
          <div className="mt-8 space-y-4 pt-10 border-t border-border/10">
             <div className="flex items-center gap-3 px-2">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">Pending Removal</p>
             </div>
             <div className="grid gap-3">
                {removedFaqs.map((faq, i) => (
                   <div key={`rem-${i}`} className="group/rem relative rounded-[1.5rem] border border-border/20 bg-muted/[0.02] p-5 opacity-60 hover:opacity-100 transition-all duration-300">
                     <div className="flex justify-between gap-6">
                       <div className="min-w-0 flex-1">
                         <p className="text-xs font-bold text-muted-foreground line-through tracking-tight mb-1">Q: {faq.question}</p>
                         <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-through italic font-medium">A: {faq.answer}</p>
                       </div>
                       {!disabled && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-2xl text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all shrink-0" 
                            onClick={() => restoreFAQ(faq)}
                          >
                            <Plus size={16} />
                          </Button>
                       )}
                     </div>
                   </div>
                ))}
             </div>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border border-border/20 shadow-2xl rounded-[2rem] bg-background">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <DialogHeader className="p-8 pb-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60 border border-primary/5">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {editingIndex !== null ? "Edit FAQ" : "Add FAQ"}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <p className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                    Knowledge Base Entry
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-8 pt-2 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  Question
                </Label>
                <span className={cn(
                  "text-[8px] font-bold tracking-widest",
                  newQ.length > MAX_Q_LENGTH ? "text-rose-500" : "text-muted-foreground/20"
                )}>
                  {newQ.length}/{MAX_Q_LENGTH}
                </span>
              </div>
              <Input
                placeholder="How do I borrow a book?"
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                disabled={disabled}
                className={cn(
                  "h-12 rounded-xl border-border/20 bg-muted/5 text-xs px-4 focus:ring-0 transition-all font-medium placeholder:text-muted-foreground/20",
                  newQ.length > MAX_Q_LENGTH && "border-rose-500/50 bg-rose-500/5"
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <Label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  Answer
                </Label>
                <span className={cn(
                  "text-[8px] font-bold tracking-widest",
                  newA.length > MAX_A_LENGTH ? "text-rose-500" : "text-muted-foreground/20"
                )}>
                  {newA.length}/{MAX_A_LENGTH}
                </span>
              </div>
              <Textarea
                placeholder="Enter the detailed answer here..."
                value={newA}
                onChange={(e) => setNewA(e.target.value)}
                disabled={disabled}
                className={cn(
                  "min-h-[150px] rounded-2xl border-border/20 bg-muted/5 text-xs p-5 resize-none focus:ring-0 transition-all leading-relaxed font-medium placeholder:text-muted-foreground/20",
                  newA.length > MAX_A_LENGTH && "border-rose-500/50 bg-rose-500/5"
                )}
              />
            </div>
          </div>

          <DialogFooter className="p-8 pt-0 flex gap-3">
             <Button 
                variant="ghost" 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 transition-all"
              >
                Cancel
              </Button>
              <Button
                onClick={addOrUpdateFAQ}
                disabled={disabled || !newQ.trim() || !newA.trim() || newQ.length > MAX_Q_LENGTH || newA.length > MAX_A_LENGTH}
                className="flex-[2] h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all active:scale-[0.98]"
              >
                {editingIndex !== null ? "Save Changes" : "Add Entry"}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

