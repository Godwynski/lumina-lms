import { Suspense } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { MainHeader } from "@/components/layout/MainHeader";
import { AuthGate } from "./_components/AuthGate";
import { StreamedNav } from "./_components/StreamedNav";
import { StreamedUserNav } from "./_components/StreamedUserNav";
import { NavSkeleton } from "./_components/Skeletons";
import { getPreferences } from "@/lib/auth-helpers";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const defaultOpen = true; // Use a static default for the instant shell.
  const preferencesPromise = getPreferences();

  return (
    <PreferencesProvider initialPreferences={preferencesPromise}>
      <SidebarProvider defaultOpen={defaultOpen}>
        {/* Sidebar streams in independently */}
        <Suspense fallback={<NavSkeleton />}>
          <StreamedNav />
        </Suspense>

        <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
          {/* Mobile Header Content - Streamed */}
          <Suspense fallback={<div className="h-14 border-b flex items-center md:hidden px-4"><div className="h-4 w-32 animate-pulse bg-muted rounded" /></div>}>
            <div className="md:hidden sticky top-0 z-40 flex w-full h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4">
              <div className="flex flex-1 items-center gap-3 overflow-hidden">
                <SidebarTrigger className="shrink-0" />
                <div className="truncate text-sm font-semibold tracking-tight">
                  <Suspense fallback={<div className="h-4 w-24 animate-pulse bg-muted/20 rounded" />}>
                    <BreadcrumbNav />
                  </Suspense>
                </div>
              </div>
              <div className="ml-2 shrink-0">
                <StreamedUserNav />
              </div>
            </div>
          </Suspense>

          {/* Desktop Header Content - Optimized shell stays static via PPR */}
          <Suspense fallback={<div className="h-14 border-b bg-background/50 animate-pulse hidden md:block" />}>
            <MainHeader />
          </Suspense>
          
          <div className="mx-auto mt-4 w-full max-w-[1450px] p-4 md:mt-0 md:pt-2 md:px-6 md:pb-6">
            {/* 
                The AuthGate ensures we are authenticated before rendering children. 
                Wrapping it in Suspense allows the parent shell to render immediately.
            */}
            <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-32 w-full bg-muted rounded" /></div>}>
              <AuthGate>
                {children}
              </AuthGate>
            </Suspense>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </PreferencesProvider>
  );
}
