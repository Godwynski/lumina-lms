import { type ReactNode } from "react";

type AuthPageShellProps = {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageShell({
  badge,
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground md:flex-row">
      <aside className="hidden border-r border-border bg-muted/30 md:flex md:w-1/2 md:flex-col md:justify-between md:p-8 lg:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
              aria-hidden="true"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">Lumina LMS</span>
        </div>

        <div className="space-y-4">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{badge}</p>
          <h1 className="text-3xl font-bold leading-tight text-foreground lg:text-4xl">{title}</h1>
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
