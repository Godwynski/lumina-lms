import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center rounded-lg border border-border bg-card p-2 shadow-sm", className)}>
      <BookOpen
        size={size}
        className="relative z-10 text-foreground"
        strokeWidth={2.25}
      />
    </div>
  );
}
