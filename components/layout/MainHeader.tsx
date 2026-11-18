"use client"

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Logo } from "@/components/layout/Logo"
import Link from "next/link"
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav"
import { cn } from "@/lib/utils"


import { NotificationBell } from "@/components/notifications/NotificationBell"

interface MainHeaderProps {
  userNav?: React.ReactNode;
}

export function MainHeader({ userNav }: MainHeaderProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <header className="sticky top-0 z-40 flex min-h-14 min-w-0 shrink-0 items-center gap-1 border-b border-border bg-background/90 px-2.5 backdrop-blur-md md:min-h-16 md:gap-4 md:border-border/20 md:bg-background/60 md:px-6 md:backdrop-blur-2xl print:hidden">
      <SidebarTrigger className="size-11 shrink-0 md:hidden" />
      <div className="flex min-w-0 flex-1 items-center">
        <div inert={!isCollapsed}
          className={cn(
            "hidden items-center gap-5 overflow-hidden transition-all duration-500 ease-in-out lg:flex",
            isCollapsed 
              ? "max-w-[240px] opacity-100 translate-x-0 mr-6" 
              : "max-w-0 opacity-0 -translate-x-8 mr-0 pointer-events-none"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3.5 shrink-0 group">
            <div className="relative">
              <Logo size={20} className="scale-90 shrink-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="absolute -inset-1 bg-primary/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="leading-none text-base font-bold tracking-tight text-foreground">Lumina</span>
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">LMS Platform</span>
            </div>
          </Link>
          <div className="h-5 w-[1px] bg-border/20 mx-1" />
        </div>

        <BreadcrumbNav />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <NotificationBell />
        {userNav && (
          <div className="hidden items-center gap-3 md:flex">
            <div className="mx-1 h-8 w-px bg-border/20" />
            {userNav}
          </div>
        )}
      </div>
    </header>
  )
}
