import { Logo } from "@/components/layout/Logo";
import { type ReactNode } from "react";

type AuthPageShellProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function AuthPageShell({
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-10">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={24} />
        <span className="text-xl font-bold tracking-tight text-foreground">Lumina LMS</span>
      </div>
      <main className="w-full max-w-md">
        {(title || description) && (
          <div className="space-y-2 text-center mb-8">
            {title && <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </main>
      <p className="mt-8 text-2xs text-muted-foreground">© 2026 Lumina LMS</p>
    </div>
  );
}
