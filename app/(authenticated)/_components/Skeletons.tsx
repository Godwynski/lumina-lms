import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";

/**
 * NavSkeleton — mirrors the exact DOM structure of ProtectedNav so that when
 * the real nav streams in, there is zero layout shift. Pixel-matches:
 *   • SidebarHeader: h-16, trigger square + logo text block
 *   • SidebarContent: 1 top-level item (Dashboard) + 2 group rows (Library, Administration)
 *   • SidebarFooter: lg-size user button row (avatar + name/email + chevron)
 *   • SidebarRail at the end
 */
export function NavSkeleton() {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Header — h-16 matches SidebarHeader in ProtectedNav */}
      <SidebarHeader className="flex flex-row h-16 shrink-0 items-center gap-4 px-4">
        {/* Trigger placeholder */}
        <Skeleton className="h-8 w-8 rounded-md shrink-0" />
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-5 w-5 rounded-sm shrink-0" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      </SidebarHeader>

      {/* Content — 1 flat item + 2 collapsible group triggers */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarMenu>
            {/* Dashboard (flat item) */}
            <SidebarMenuItem>
              <SidebarMenuButton className="pointer-events-none">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-3.5 w-24 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Library group trigger */}
            <SidebarMenuItem>
              <SidebarMenuButton className="pointer-events-none">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-3.5 w-20 group-data-[collapsible=icon]:hidden" />
                <Skeleton className="ml-auto h-4 w-4 rounded group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Administration group trigger */}
            <SidebarMenuItem>
              <SidebarMenuButton className="pointer-events-none">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <Skeleton className="h-3.5 w-28 group-data-[collapsible=icon]:hidden" />
                <Skeleton className="ml-auto h-4 w-4 rounded group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — lg size button mirrors ProtectedNav's SidebarMenuButton size="lg" */}
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-2 hidden md:flex">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              {/* Avatar circle */}
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              {/* Name + email stacked */}
              <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
              {/* Chevrons icon */}
              <Skeleton className="ml-auto h-4 w-4 rounded group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="flex h-16 items-center justify-between px-8 border-b border-border/40 bg-background/60">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}
