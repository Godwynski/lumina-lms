import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { type ReactNode } from "react";

type AuthPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageShell({
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground md:flex-row">
      <aside className="hidden border-r border-border bg-muted/30 md:flex md:w-1/2 md:flex-col md:justify-between md:p-8 lg:p-10">
        <Link href="/" className="flex items-center gap-3 w-fit hover:opacity-80 transition-opacity">
          <Logo size={18} className="scale-90" />
          <span className="text-base font-bold tracking-tight text-foreground">Lumina LMS</span>
        </Link>

        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold leading-tight text-foreground lg:text-4xl">
            {title}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <p className="text-2xs text-muted-foreground">© 2026 Lumina LMS</p>
      </aside>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-10 lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
