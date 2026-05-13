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
    <div className={cn("mx-auto flex w-full max-w-[1450px] flex-col gap-4 p-4 md:p-6", className)}>
      {(title || headerActions) && (
        <div className={cn(
          "flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between",
          !isGhost && "border-b border-border/5 pb-6"
        )}>
          <div className="flex flex-col gap-1.5">
            {title && (
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {description && (
              <div className="text-sm font-medium text-muted-foreground hidden md:block opacity-70 leading-relaxed max-w-2xl">
                {description}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
          </div>
        </div>
      )}

      {feedback}

      {controls && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center bg-muted/5 p-2 rounded-[2rem] border border-border/5 backdrop-blur-[2px]">
          {controls}
        </div>
      )}

      <div className={cn(
        "overflow-hidden transition-all duration-500",
        isGhost 
          ? "rounded-none border-none bg-transparent shadow-none" 
          : "rounded-[2.5rem] border border-border/10 bg-card/40 shadow-sm backdrop-blur-sm"
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
            isGhost ? "mt-6" : "border-t border-border/10 bg-muted/10"
          )}>
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
}
