import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getUserRole } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { UserNav } from "@/components/layout/UserNav";
import { ProtectedNav } from "@/components/layout/ProtectedNav";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { cookies } from "next/headers";
import { AccountPendingScreen } from "@/components/auth/AccountPendingScreen";
import { MainHeader } from "@/components/layout/MainHeader";

type Role = "admin" | "librarian" | "staff" | "student" | null;



export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // We MUST check auth at the very top to prevent unauthenticated flashes
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Fetch full profile and role in parallel to avoid waterfalls. 
  // Gatekeeper needs this anyway, so doing it at the top level is required.
  const [roleResult, profileResult] = await Promise.all([
    getUserRole() as Promise<Role>,
    supabase.from("profiles").select("*").eq("id", user.id).single()
  ]);

  const role = roleResult;
  const profile = profileResult.data;

  const isAccessBlocked = 
    profile?.status === "PENDING" || 
    profile?.status === "SUSPENDED" || 
    profile?.status === "INACTIVE";

  // Librarians and Admins should be able to access the system to manage users
  const isPrivileged = profile?.role === "admin" || profile?.role === "librarian";

  if (isAccessBlocked && !isPrivileged) {
    return <AccountPendingScreen />;
  }

  return (
    <PreferencesProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <ProtectedNav role={role} user={user} profile={profile} />

        <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
          {/* Mobile Header Content */}
          <div className="md:hidden sticky top-0 z-40 flex w-full h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4">
            <div className="flex flex-1 items-center gap-3 overflow-hidden">
              <SidebarTrigger className="shrink-0" />
              <div className="truncate">
                <BreadcrumbNav />
              </div>
            </div>
            <div className="ml-2 shrink-0">
              <UserNav user={user} profile={profile} role={role} />
            </div>
          </div>

          {/* Desktop Header Content */}
          <MainHeader />
          
          <div className="mx-auto mt-4 w-full max-w-[1450px] p-4 md:mt-0 md:pt-2 md:px-6 md:pb-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </PreferencesProvider>
  );
}
