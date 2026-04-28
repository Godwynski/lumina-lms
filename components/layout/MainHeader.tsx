"use client"

import { Suspense } from "react"

import { useSidebar } from "@/components/ui/sidebar"
import { Logo } from "@/components/layout/Logo"
import Link from "next/link"
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav"
import { cn } from "@/lib/utils"


import { NotificationBell } from "@/components/notifications/notification-bell"

interface MainHeaderProps {
  userNav?: React.ReactNode;
}

export function MainHeader({ userNav }: MainHeaderProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <header className="sticky top-0 z-40 hidden md:flex h-16 shrink-0 items-center gap-4 border-b border-border/20 bg-background/60 backdrop-blur-2xl px-8 transition-all duration-300">
      <div className="flex items-center gap-6 flex-1 overflow-hidden">
        <div 
          className={cn(
            "flex items-center gap-5 transition-all duration-500 ease-in-out",
            isCollapsed 
              ? "max-w-[240px] opacity-100 translate-x-0 mr-2" 
              : "max-w-0 opacity-0 -translate-x-8 mr-0 pointer-events-none"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3.5 shrink-0 group" aria-label="Lumina LMS Platform">
            <div className="relative">
              <Logo size={20} className="scale-90 shrink-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="absolute -inset-1 bg-primary/10 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="leading-none text-[15px] font-black tracking-tight text-foreground/90">Lumina</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">LMS Platform</span>
            </div>
          </Link>
          <div className="h-5 w-[1px] bg-border/20 mx-1" />
        </div>
        
        <div className="flex-1 truncate">
          <Suspense fallback={<div className="h-4 w-32 animate-pulse bg-muted/20 rounded-full" />}>
            <div className="text-xs font-semibold tracking-wide">
              <BreadcrumbNav />
            </div>
          </Suspense>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {userNav && (
            <>
              <div className="h-8 w-[1px] bg-border/20 mx-1" />
              {userNav}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
