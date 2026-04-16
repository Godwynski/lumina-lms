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
}: AdminTableShellProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[1450px] flex-col gap-3", className)}>
      {(title || headerActions) && (
        <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center bg-muted/20 p-2 rounded-2xl border border-border/40 backdrop-blur-[2px]">
          {controls}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/10">
          {children}
        </div>
        {pagination ? <div className="border-t border-border bg-muted/10 p-2.5">{pagination}</div> : null}
      </div>
    </div>
  );
}
