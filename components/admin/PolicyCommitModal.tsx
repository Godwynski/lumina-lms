import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  changedKeys: string[];
  initialValues: Record<string, string>;
  formData: Record<string, string>;
  loading: boolean;
}

export function PolicyCommitModal({
  isOpen,
  onClose,
  onConfirm,
  changedKeys,
  initialValues,
  formData,
  loading
}: CommitModalProps) {
  const [reason, setReason] = useState("");

  const formatKey = (key: string) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').replace("Loan", "Borrow");

  const renderDiffDetails = (key: string, oldVal: string, newVal: string) => {
    if (oldVal === newVal) return null;
    
    // Check if it's a JSON array (like FAQs)
    if ((oldVal?.startsWith("[") && oldVal?.endsWith("]")) || (newVal?.startsWith("[") && newVal?.endsWith("]"))) {
      try {
        const oldArr = oldVal ? JSON.parse(oldVal) : [];
        const newArr = newVal ? JSON.parse(newVal) : [];
        
        if (Array.isArray(oldArr) && Array.isArray(newArr)) {
          const added = newArr.filter(newItem => !oldArr.some(oldItem => JSON.stringify(oldItem) === JSON.stringify(newItem)));
          const removed = oldArr.filter(oldItem => !newArr.some(newItem => JSON.stringify(newItem) === JSON.stringify(oldItem)));
          
          if (added.length === 0 && removed.length === 0) return <span className="text-[10px] text-muted-foreground/60 italic font-medium">Reordered items</span>;

          const getLabel = (item: unknown) => {
            if (typeof item === 'object' && item !== null) {
              const obj = item as Record<string, unknown>;
              return String(obj.question ?? obj.name ?? JSON.stringify(item));
            }
            return String(item);
          };

          return (
            <div className="mt-2 space-y-2 border-t border-border/5 pt-2">
              {added.map((item: unknown, i: number) => (
                <div key={`add-${i}`} className="flex items-start gap-2 text-[10px] text-green-600/90 dark:text-green-400/90 font-medium leading-tight">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="line-clamp-2">Added: {getLabel(item)}</span>
                </div>
              ))}
              {removed.map((item: unknown, i: number) => (
                <div key={`rem-${i}`} className="flex items-start gap-2 text-[10px] text-red-600/70 dark:text-red-400/70 font-medium leading-tight italic">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500/50 shrink-0" />
                  <span className="line-through decoration-red-500/30 line-clamp-2">Removed: {getLabel(item)}</span>
                </div>
              ))}
            </div>
          );
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Default string diff
    return (
      <div className="mt-1 flex items-center gap-2.5 text-[10px]">
        <span className="text-muted-foreground/40 line-through truncate max-w-[120px]">{oldVal || "Null"}</span>
        <ArrowRight className="h-2.5 w-2.5 text-primary/30" />
        <span className="font-bold text-primary truncate max-w-[150px]">{newVal}</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] border-border bg-background rounded-[3rem] p-0 overflow-hidden shadow-2xl">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        
        <div className="p-8 space-y-8">
          <DialogHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border border-primary/5">
                <Check className="h-7 w-7" />
              </div>
              <div className="px-3 py-1 rounded-full bg-muted/40 border border-border/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Review Stage
              </div>
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Review Updates</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground/70 leading-relaxed font-medium">
                You&apos;re about to apply {changedKeys.length} system {changedKeys.length === 1 ? 'change' : 'changes'}.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="max-h-[280px] overflow-y-auto -mx-2 px-2 space-y-3 custom-scrollbar">
              {changedKeys.map(key => (
                <div key={key} className="group relative p-4 rounded-3xl bg-muted/10 border border-border/30 hover:bg-muted/20 hover:border-primary/10 transition-all duration-300 shadow-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{formatKey(key)}</span>
                    {renderDiffDetails(key, initialValues[key], formData[key])}
                  </div>
                  <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-primary/5 flex items-center justify-center text-primary/40 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                    <Check className="h-3 w-3" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 px-1 ml-1">
                Audit Reason
              </label>
              <div className="relative group">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you making these changes?"
                  className="min-h-[100px] rounded-2xl border-border/40 bg-muted/5 text-xs font-medium focus:bg-background transition-all p-4 resize-none shadow-inner focus:ring-1 focus:ring-primary/20"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/5 text-[9px] text-amber-600 font-bold border border-amber-500/10">
                  <AlertCircle className="h-2.5 w-2.5" />
                  <span>Public Log</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0 flex gap-3">
          <Button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-[2] h-14 rounded-2xl text-xs font-black uppercase tracking-[0.1em] shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Processing
              </div>
            ) : "Finalize & Apply"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl text-xs font-black uppercase tracking-[0.1em] border-border/60 hover:bg-muted/30"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
