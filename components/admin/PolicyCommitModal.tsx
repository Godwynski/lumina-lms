import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, ArrowRight, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  changedKeys: string[];
  initialValues: Record<string, string>;
  formData: Record<string, string>;
  loading: boolean;
}

/**
 * A dialog to review and confirm system policy changes with an audit reason.
 */
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

  const formatKey = (key: string) => 
    key.split('_')
       .map(w => w.charAt(0).toUpperCase() + w.slice(1))
       .join(' ')
       .replace("Loan", "Borrow");

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
          
          if (added.length === 0 && removed.length === 0) {
             return <span className="text-[10px] text-muted-foreground/50 italic font-medium">Reordered collection items</span>;
          }

          const getLabel = (item: unknown) => {
            if (typeof item === 'object' && item !== null) {
              const obj = item as Record<string, unknown>;
              return String(obj.question ?? obj.name ?? obj.title ?? JSON.stringify(item));
            }
            return String(item);
          };

          return (
            <div className="mt-3 space-y-2 border-t border-border/5 pt-3">
              {added.map((item: unknown, i: number) => (
                <div key={`add-${i}`} className="flex items-start gap-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
                  <span className="line-clamp-2">Added: {getLabel(item)}</span>
                </div>
              ))}
              {removed.map((item: unknown, i: number) => (
                <div key={`rem-${i}`} className="flex items-start gap-2 text-[10px] text-rose-600/70 dark:text-rose-400/70 font-medium leading-tight italic">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500/50 shrink-0" />
                  <span className="line-through decoration-rose-500/30 line-clamp-2">Removed: {getLabel(item)}</span>
                </div>
              ))}
            </div>
          );
        }
      } catch {
        // Fallback to string diff
      }
    }

    // Default string diff
    return (
      <div className="mt-2 flex items-center gap-3 text-[11px] font-bold">
        <span className="text-muted-foreground/30 line-through truncate max-w-[140px] font-medium">{oldVal || "Empty"}</span>
        <ArrowRight className="h-3 w-3 text-primary/30 shrink-0" />
        <span className="text-primary truncate max-w-[180px] bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
          {newVal || "Empty"}
        </span>
      </div>
    );
  };

  const isFormValid = reason.trim().length >= 10;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] border-border/40 bg-background rounded-[3rem] p-0 overflow-hidden shadow-2xl">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="p-8 md:p-10 space-y-10">
          <DialogHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-16 w-16 rounded-[1.5rem] bg-primary/[0.03] flex items-center justify-center text-primary shadow-inner border border-primary/5 ring-4 ring-primary/5">
                <Check className="h-8 w-8" />
              </div>
              <div className="px-4 py-1.5 rounded-full bg-muted/40 border border-border/40 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 shadow-xs">
                Draft Changes
              </div>
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-3xl font-black tracking-tight text-foreground">Review Updates</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground/60 leading-relaxed font-medium">
                You are about to commit <span className="text-foreground font-bold">{changedKeys.length}</span> modifications to the system policies.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-8">
            <div className={cn(
              "max-h-[300px] overflow-y-auto -mx-2 px-2 space-y-4 custom-scrollbar pr-4",
              "scrollbar-thin scrollbar-thumb-muted-foreground/10"
            )}>
              {changedKeys.map(key => (
                <div key={key} className="group relative p-5 rounded-[2rem] bg-muted/5 border border-border/10 hover:bg-muted/10 hover:border-primary/10 transition-all duration-500 shadow-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                      {formatKey(key)}
                    </span>
                    {renderDiffDetails(key, initialValues[key], formData[key])}
                  </div>
                  <div className="absolute top-5 right-5 h-8 w-8 rounded-full bg-primary/[0.03] flex items-center justify-center text-primary/30 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500 border border-primary/5">
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 ml-1">
                  Audit Protocol Reason
                </label>
                <span className={cn(
                  "text-[9px] font-bold uppercase transition-colors",
                  isFormValid ? "text-emerald-500" : "text-amber-500"
                )}>
                  {reason.length < 10 ? `${10 - reason.length} chars min` : 'Validated'}
                </span>
              </div>
              <div className="relative group">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a detailed reason for these changes for the audit log..."
                  className="min-h-[120px] rounded-[1.5rem] border-border/20 bg-muted/5 text-xs font-medium focus:bg-background transition-all duration-500 p-5 resize-none shadow-inner focus:ring-4 focus:ring-primary/5 focus:border-primary/20"
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/[0.03] text-[10px] text-amber-600/80 font-black uppercase tracking-wider border border-amber-500/10 backdrop-blur-sm shadow-xs">
                  <Info className="h-3 w-3" />
                  <span>Permanent Log</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10 pt-0 flex gap-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border-border/40 hover:bg-muted/40 hover:border-border transition-all duration-300"
          >
            Abort
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={loading || !isFormValid}
            className={cn(
              "flex-[2] h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all duration-500 hover:scale-[1.02] active:scale-95",
              "shadow-primary/20 hover:shadow-primary/30"
            )}
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Processing
              </div>
            ) : "Confirm & Commit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
