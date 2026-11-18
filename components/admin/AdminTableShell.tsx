import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Props for the AdminTableShell component.
 */
interface AdminTableShellProps {
  /** The title of the page or section. */
  title?: ReactNode;
  /** A short description or subtitle. */
  description?: ReactNode;
  /** Actions to be placed in the header (e.g., buttons). */
  headerActions?: ReactNode;
  /** Optional feedback or alert component to show above the controls. */
  feedback?: ReactNode;
  /** Controls for filtering or searching the table data. */
  controls?: ReactNode;
  /** The main content (usually a table or list). */
  children: ReactNode;
  /** Optional pagination component. */
  pagination?: ReactNode;
  /** Additional CSS classes for the root element. */
  className?: string;
  /** Visual variant of the shell. Defaults to 'default'. */
  variant?: 'default' | 'ghost';
}

/**
 * A standardized layout shell for administrative tables and lists.
 * Provides consistent header, controls, content, and pagination styling.
 */
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
    <div className={cn("flex w-full min-w-0 flex-col gap-4", className)}>
      {(title || headerActions) && (
        <div className={cn(
          "flex min-w-0 flex-col gap-3 pb-2 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between",
          !isGhost && "border-b border-border/5 pb-6"
        )}>
          <div className="flex min-w-0 flex-col gap-1.5">
            {title && (
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <div className="text-sm font-medium text-muted-foreground leading-relaxed max-w-2xl">
                {description}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
          </div>
        </div>
      )}

      {feedback}

      {controls && (
        <div className="relative z-10 flex min-w-0 flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-2.5 lg:flex-row lg:flex-wrap lg:items-center">
          {controls}
        </div>
      )}

      <div className={cn(
        "overflow-hidden transition-all duration-300",
        isGhost 
          ? "rounded-none border-none bg-transparent shadow-none" 
          : "rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm"
      )}>
        <div className={cn("relative group/table", !isGhost && "overflow-hidden")}>
          <div className={cn(
            "px-0.5",
            !isGhost && "overflow-x-auto scrollbar-none md:scrollbar-thin scrollbar-thumb-muted-foreground/10"
          )}>
            {children}
          </div>
          
          {/* Mobile scroll indicator gradient */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card/80 to-transparent opacity-0 sm:hidden group-hover/table:opacity-100 transition-opacity duration-300" />
        </div>

        {pagination && (
          <div className={cn(
            "p-4",
            isGhost ? "mt-6" : "border-t border-border/40 bg-muted/20"
          )}>
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
}
