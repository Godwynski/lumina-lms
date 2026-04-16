"use client"

import { Suspense } from "react"

import { useSidebar } from "@/components/ui/sidebar"
import { Logo } from "@/components/layout/Logo"
import Link from "next/link"
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav"
import { cn } from "@/lib/utils"

export function MainHeader() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <header className="sticky top-0 z-40 hidden md:flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-md px-6 transition-all duration-200">
      <div className="flex items-center gap-4 flex-1 overflow-hidden">
        <div 
          className={cn(
            "flex items-center gap-4 transition-all duration-300 ease-in-out",
            isCollapsed 
              ? "max-w-[200px] opacity-100 translate-x-0 mr-2" 
              : "max-w-0 opacity-0 -translate-x-4 mr-0 pointer-events-none"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0" aria-label="Lumina LMS Platform">
            <Logo size={18} className="scale-90 shrink-0" />
            <div className="flex flex-col whitespace-nowrap">
              <span className="leading-none text-sm font-bold tracking-tight text-foreground">Lumina</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">LMS Platform</span>
            </div>
          </Link>
          <div className="h-4 w-[1px] bg-border mx-1" />
        </div>
        
        <div className="flex-1 truncate">
          <Suspense fallback={<div className="h-4 w-32 animate-pulse bg-muted/40 rounded" />}>
            <BreadcrumbNav />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
