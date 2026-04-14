import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminTableShellProps = {
  title: string;
  description: string;
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
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden md:block">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {headerActions}
      </div>

      {feedback}

      {controls ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{controls}</div> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">{children}</div>
        {pagination ? <div className="border-t border-border p-2">{pagination}</div> : null}
      </div>
    </div>
  );
}
