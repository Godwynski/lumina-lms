import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminTableShellProps = {
  title?: string;
  description?: ReactNode;
  headerActions?: ReactNode;
  feedback?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
  className?: string;
  variant?: 'default' | 'ghost';
};

export function AdminTableShell({
  title,
  description,
  headerActions,
  feedback,
  controls,
  children,
  pagination,
  className,
  variant = 'default',
}: AdminTableShellProps) {
  const isGhost = variant === 'ghost';

  return (
    <div className={cn("mx-auto flex w-full max-w-[1450px] flex-col gap-3", className)}>
      {(title || headerActions) && (
        <div className={cn(
          "flex flex-col gap-4 pb-4 sm:flex-row sm:items-end sm:justify-between",
          !isGhost && "border-b border-border/10 pb-4"
        )}>
          <div className="flex flex-col gap-1">
            {title && <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>}
            {description && <div className="text-sm font-medium text-muted-foreground hidden md:block opacity-70 leading-relaxed">{description}</div>}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
          </div>
        </div>
      )}

      {feedback}

      {controls ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center bg-muted/10 p-2 rounded-2xl backdrop-blur-[2px]">
          {controls}
        </div>
      ) : null}

      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isGhost 
          ? "rounded-none border-none bg-transparent shadow-none" 
          : "rounded-2xl border border-border/10 bg-card/50 shadow-xs"
      )}>
        <div className="relative group/table overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 px-0.5">
            {children}
          </div>
          {/* Subtle mobile scroll indicator gradient */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/80 to-transparent opacity-0 sm:hidden group-hover/table:opacity-100 transition-opacity" />
        </div>
        {pagination ? (
          <div className={cn(
            "p-2.5",
            isGhost ? "mt-4" : "border-t border-border/10 bg-muted/5"
          )}>
            {pagination}
          </div>
        ) : null}
      </div>
    </div>
  );
}
