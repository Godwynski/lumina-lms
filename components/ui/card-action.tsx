import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// Same look as <Card>, but rendered as a native link or button so it is
// keyboard reachable and announced correctly.
const cardActionBase =
  "block w-full text-left rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function CardLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return <Link className={cn(cardActionBase, className)} {...props} />;
}

export function CardButton({
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(cardActionBase, className)} {...props} />;
}
