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

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
  contentClassName?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  contentClassName,
}: EmptyStateProps) {
  return (
    <Card className={cn("w-full border-dashed border-border bg-card shadow-sm", className)}>
      <CardContent
        className={cn(
          "flex min-h-[380px] flex-col items-center justify-center px-6 py-12 text-center sm:px-10 sm:py-16",
          contentClassName,
        )}
      >
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
          <Icon size={38} />
        </div>
        <h3 className="mb-2 text-2xl font-bold tracking-tight text-foreground">{title}</h3>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>

        {action ? (
          action.href ? (
            <Button
              asChild
              className="mt-7 h-11 rounded-lg bg-primary px-6 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground hover:bg-primary/90"
            >
              <Link href={action.href}>
                {action.icon ? <action.icon size={18} /> : null}
                {action.label}
              </Link>
            </Button>
          ) : (
            <Button
              onClick={action.onClick}
              className="mt-7 h-11 rounded-lg bg-primary px-6 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground hover:bg-primary/90"
            >
              {action.icon ? <action.icon size={18} /> : null}
              {action.label}
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
