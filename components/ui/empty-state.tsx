import { type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
};

type EmptyStateVariant = "first-use" | "no-results";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  variant?: EmptyStateVariant;
  noCard?: boolean;
  className?: string;
  contentClassName?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "first-use",
  noCard = false,
  className,
  contentClassName,
}: EmptyStateProps) {
  const isNoResults = variant === "no-results";

  const body = (
    <div
      data-empty-variant={variant}
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center sm:px-10",
        isNoResults ? "min-h-[260px] py-10 sm:py-12" : "min-h-[340px] py-12 sm:py-16",
        contentClassName,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-2xl border border-border text-muted-foreground",
            isNoResults ? "h-14 w-14 bg-muted/60" : "h-16 w-16 bg-muted"
          )}
        >
          <Icon size={isNoResults ? 26 : 32} aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="mb-1.5 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>

      {action ? (
        action.href ? (
          <Button
            asChild
            variant={isNoResults ? "outline" : "default"}
            className="mt-6 h-10 rounded-lg px-5 text-sm font-semibold"
          >
            <Link href={action.href}>
              {action.icon ? <action.icon size={16} aria-hidden="true" /> : null}
              {action.label}
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={action.onClick}
            variant={isNoResults ? "outline" : "default"}
            className="mt-6 h-10 rounded-lg px-5 text-sm font-semibold"
          >
            {action.icon ? <action.icon size={16} aria-hidden="true" /> : null}
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );

  if (noCard) {
    return <div className={cn("w-full", className)}>{body}</div>;
  }

  return (
    <Card className={cn("w-full rounded-xl border-dashed border-border bg-card shadow-sm", className)}>
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  );
}
