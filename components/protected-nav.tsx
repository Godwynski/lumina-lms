"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Users,
  Settings,
  LayoutDashboard,
  History,
  CreditCard,
  BarChart2,
  ShieldCheck,
  Library,
  BookMarked,
  BookOpen,
  ScanLine,
} from "lucide-react";

function LuminaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-indigo-600 shrink-0"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

type Role = "admin" | "librarian" | "staff" | "student" | null;

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV_LINKS: NavLink[] = [
  {
    href: "/protected",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "librarian", "staff", "student"],
  },
  {
    href: "/protected/catalog",
    label: "Catalog & Inventory",
    icon: Library,
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/borrow",
    label: "Circulation Checkout",
    icon: ScanLine,
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/student-catalog",
    label: "Book Catalog",
    icon: Library,
    roles: ["student"],
  },
  {
    href: "/protected/users",
    label: "Users & Roles",
    icon: Users,
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/admin/approvals",
    label: "Card Approvals",
    icon: ShieldCheck,
    roles: ["admin", "librarian"],
  },
  {
    href: "/protected/fines",
    label: "Fines",
    icon: BookMarked,
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/reports",
    label: "Reports & Analytics",
    icon: BarChart2,
    roles: ["admin", "librarian", "staff"],
  },
  {
    href: "/protected/history",
    label: "My History",
    icon: History,
    roles: ["admin", "librarian", "staff", "student"],
  },
  {
    href: "/protected/my-card",
    label: "E-Library Card",
    icon: CreditCard,
    roles: ["staff", "student"],
  },
  {
    href: "/protected/resources",
    label: "Digital Resources",
    icon: BookOpen,
    roles: ["admin", "librarian", "staff", "student"],
  },
  {
    href: "/protected/settings",
    label: "Settings",
    icon: Settings,
    roles: ["admin"],
  },
  {
    href: "/protected/audit",
    label: "Audit Logs",
    icon: ShieldCheck,
    roles: ["admin"],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/protected") return pathname === href;
  return pathname.startsWith(href);
}

export function ProtectedNav({
  authNode,
  role,
}: {
  authNode?: React.ReactNode;
  role?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Strict filtering to prevent hydration mismatch
  const visibleLinks = NAV_LINKS.filter(
    (link) => role && link.roles.includes(role as Role)
  );

  const currentLink = visibleLinks.find((link) => isActive(pathname, link.href));
  const moduleName = currentLink?.label ?? "Dashboard";

  return (
    <>
      {/* MOBILE NAVIGATION */}
      <header className="fixed top-0 left-0 right-0 z-[60] flex items-center h-14 px-4 bg-white border-b border-zinc-200 shadow-sm md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 -ml-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg outline-none"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="h-5 w-px bg-zinc-200 mx-3" />
        <Link href="/protected">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <LuminaLogo size={14} />
          </div>
        </Link>
        <div className="h-5 w-px bg-zinc-200 mx-3" />
        <span className="text-sm font-semibold text-zinc-900 truncate">
          {moduleName}
        </span>
      </header>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-[55] bg-zinc-900/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.nav
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-[56] w-[280px] bg-white border-r border-zinc-200 flex flex-col pt-16"
            >
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
                {visibleLinks.map((link) => {
                  const active = isActive(pathname, link.href);
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${
                        active ? "bg-indigo-50 text-indigo-700" : "text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Icon size={18} className={active ? "text-indigo-600" : "text-zinc-400"} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
              <div className="p-4 border-t border-zinc-200 bg-white">
                {authNode}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 lg:w-72 flex-col bg-white border-r border-zinc-200">
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 shrink-0">
          <Link href="/protected" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <LuminaLogo size={16} />
            </div>
            <span className="font-bold text-base text-zinc-900">Lumina LMS</span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative">
          <span className="text-xs font-semibold text-zinc-400 uppercase mb-3 ml-2 mt-2">Main Menu</span>
          {visibleLinks.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? "text-indigo-700" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="desktopNavIndicator"
                    className="absolute inset-0 rounded-xl bg-indigo-50 border border-indigo-100/50"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <Icon size={18} className={`shrink-0 ${active ? "text-indigo-600" : "text-zinc-400"}`} />
                  <span className="truncate">{link.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 flex items-center justify-between">
          {authNode}
        </div>
      </aside>
    </>
  );
}
