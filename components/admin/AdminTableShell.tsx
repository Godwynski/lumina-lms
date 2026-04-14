import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminTableShellProps = {
  title: string;
  description: ReactNode;
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
    <div className={cn("mx-auto flex w-full max-w-7xl flex-col gap-2", className)}>
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          <div className="text-sm text-muted-foreground hidden md:block">{description}</div>
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
